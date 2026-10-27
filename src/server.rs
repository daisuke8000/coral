use std::path::PathBuf;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::{CONTENT_TYPE, HOST};
use axum::http::{Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use log::{debug, info, warn};
use prost::bytes::Bytes;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::domain::GraphModel;

#[derive(Clone)]
pub struct AppState {
    pub graph_json: Bytes,
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_graph(State(state): State<AppState>) -> impl IntoResponse {
    (
        [(CONTENT_TYPE, "application/json")],
        state.graph_json.clone(),
    )
}

fn is_local_authority(authority: &axum::http::uri::Authority) -> bool {
    let host = authority.host();
    !authority.as_str().contains('@')
        && (host.eq_ignore_ascii_case("localhost") || host == "127.0.0.1")
        && (!authority.as_str().contains(':') || authority.port_u16().is_some())
}

async fn require_local_authority(request: Request, next: Next) -> Response {
    let mut hosts = request.headers().get_all(HOST).iter();
    let host_header = hosts.next();
    let host = host_header
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<axum::http::uri::Authority>().ok());
    let uri_authority = request.uri().authority();
    let valid = (host_header.is_none() || host.is_some())
        && hosts.next().is_none()
        && host
            .as_ref()
            .or(uri_authority)
            .is_some_and(is_local_authority)
        && uri_authority.is_none_or(|authority| {
            is_local_authority(authority) && host.as_ref().is_none_or(|host| host == authority)
        });
    if !valid {
        return StatusCode::BAD_REQUEST.into_response();
    }
    next.run(request).await
}

fn create_cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
        ])
        .allow_methods([Method::GET, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE])
}

pub fn create_router(graph: GraphModel) -> Router {
    create_router_with_static(graph, None)
}

pub fn create_router_with_static(graph: GraphModel, static_dir: Option<PathBuf>) -> Router {
    let state = AppState {
        graph_json: Bytes::from(
            serde_json::to_vec(&graph).expect("graph model should always serialize"),
        ),
    };

    let api_routes = Router::new()
        .route("/health", get(health))
        .route("/api/graph", get(get_graph))
        .layer(create_cors_layer())
        .with_state(state);

    let router = if let Some(dir) = static_dir {
        debug!("Serving static files from: {:?}", dir);
        let serve_dir = ServeDir::new(dir).append_index_html_on_directories(true);
        api_routes.fallback_service(serve_dir)
    } else {
        api_routes
    };
    router.layer(middleware::from_fn(require_local_authority))
}

pub async fn serve(graph: GraphModel, port: u16) -> anyhow::Result<()> {
    serve_with_static(graph, port, None).await
}

pub async fn serve_with_static(
    graph: GraphModel,
    port: u16,
    static_dir: Option<PathBuf>,
) -> anyhow::Result<()> {
    let router = create_router_with_static(graph, static_dir.clone());
    let addr = format!("127.0.0.1:{port}");

    info!("🪸 Coral server starting on http://localhost:{port}");
    info!("   Graph API: http://localhost:{port}/api/graph");
    if let Some(ref dir) = static_dir {
        info!("   Frontend:  http://localhost:{port}/");
        match dir.canonicalize() {
            Ok(canonical) => info!(
                "   Static dir: {} (resolved: {})",
                dir.display(),
                canonical.display()
            ),
            Err(e) => log::warn!(
                "   Static dir {} could not be resolved: {}",
                dir.display(),
                e
            ),
        }
    }
    warn!("   Local API access is unauthenticated; avoid using Coral on shared machines");
    eprintln!("   Press Ctrl+C to stop");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C handler");
    info!("🪸 Shutting down gracefully...");
}

#[cfg(test)]
mod tests {
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    use super::*;
    use crate::domain::{Edge, MethodSignature, Node, NodeDetails, NodeType, Package};

    fn test_graph() -> GraphModel {
        GraphModel {
            nodes: vec![Node::new(
                "user.v1.UserService".to_string(),
                NodeType::Service,
                "user.v1".to_string(),
                "UserService".to_string(),
                "user/v1/user.proto".to_string(),
                NodeDetails::Service {
                    methods: vec![MethodSignature {
                        name: "GetUser".to_string(),
                        input_type: "GetUserRequest".to_string(),
                        output_type: "GetUserResponse".to_string(),
                    }],
                    messages: vec![],
                },
            )],
            edges: vec![Edge::new(
                "user.v1.UserService".to_string(),
                "google.protobuf.Timestamp".to_string(),
            )],
            packages: vec![Package::new(
                "user.v1".to_string(),
                vec!["user.v1.UserService".to_string()],
            )],
        }
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/health")
            .header(HOST, "localhost:3000")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_graph_endpoint() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/api/graph")
            .header(HOST, "localhost:3000")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let graph: GraphModel = serde_json::from_slice(&body).unwrap();

        assert_eq!(graph.nodes.len(), 1);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.packages.len(), 1);
    }

    #[tokio::test]
    async fn test_graph_endpoint_json_structure() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/api/graph")
            .header(HOST, "localhost:3000")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json_str = String::from_utf8(body.to_vec()).unwrap();

        assert!(json_str.contains("\"nodes\""));
        assert!(json_str.contains("\"edges\""));
        assert!(json_str.contains("\"packages\""));
        assert!(json_str.contains("\"type\":\"service\""));
        assert!(json_str.contains("\"nodeIds\""));
    }

    #[tokio::test]
    async fn test_cors_preflight() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .method("OPTIONS")
            .uri("/api/graph")
            .header(HOST, "localhost:3000")
            .header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "GET")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        assert!(response.status().is_success() || response.status() == StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn test_not_found() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/nonexistent")
            .header(HOST, "localhost:3000")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_graph_content_type() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/api/graph")
            .header(HOST, "localhost:3000")
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        let content_type = response.headers().get("content-type").unwrap();
        assert!(content_type.to_str().unwrap().contains("application/json"));
    }

    #[tokio::test]
    async fn rejects_untrusted_authorities_before_api_and_static_routing() {
        let router = create_router_with_static(test_graph(), Some(std::env::temp_dir()));
        for path in ["/api/graph", "/health", "/index.html"] {
            for host in [
                None,
                Some("attacker.example:3000"),
                Some("localhost.attacker.example"),
                Some("localhost@attacker.example"),
                Some("attacker@localhost"),
                Some("localhost:bad"),
            ] {
                let mut request = Request::builder().uri(path);
                if let Some(host) = host {
                    request = request.header(HOST, host);
                }
                let response = router
                    .clone()
                    .oneshot(request.body(Body::empty()).unwrap())
                    .await
                    .unwrap();
                assert_eq!(
                    response.status(),
                    StatusCode::BAD_REQUEST,
                    "{path} {host:?}"
                );
            }
        }
        for request in [
            Request::builder()
                .uri("/api/graph")
                .header(HOST, "localhost")
                .header(HOST, "attacker.example"),
            Request::builder()
                .uri("http://attacker.example/api/graph")
                .header(HOST, "localhost"),
            Request::builder()
                .uri("http://localhost:3000/api/graph")
                .header(HOST, "localhost:4000"),
            Request::builder()
                .method("OPTIONS")
                .uri("/api/graph")
                .header(HOST, "attacker.example")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET"),
        ] {
            let response = router
                .clone()
                .oneshot(request.body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }

    #[tokio::test]
    async fn serves_localhost_and_loopback_on_custom_ports() {
        for host in [
            "localhost",
            "localhost:3000",
            "LOCALHOST:4000",
            "127.0.0.1:9000",
        ] {
            let response = create_router(test_graph())
                .oneshot(
                    Request::builder()
                        .uri("/api/graph")
                        .header(HOST, host)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK, "{host}");
        }
    }
}
