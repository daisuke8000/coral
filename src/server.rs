use std::path::PathBuf;

use axum::extract::State;
use axum::http::header::CONTENT_TYPE;
use axum::http::{Method, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use log::{debug, info};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::domain::GraphModel;

#[derive(Clone)]
pub struct AppState {
    pub graph: GraphModel,
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_graph(State(state): State<AppState>) -> impl IntoResponse {
    Json(state.graph.clone())
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
    let state = AppState { graph };

    let api_routes = Router::new()
        .route("/health", get(health))
        .route("/api/graph", get(get_graph))
        .layer(create_cors_layer())
        .with_state(state);

    if let Some(dir) = static_dir {
        debug!("Serving static files from: {:?}", dir);
        let serve_dir = ServeDir::new(dir).append_index_html_on_directories(true);
        api_routes.fallback_service(serve_dir)
    } else {
        api_routes
    }
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
    if static_dir.is_some() {
        info!("   Frontend:  http://localhost:{port}/");
    }
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
                "user.v1/user".to_string(),
                NodeType::Service,
                "user.v1".to_string(),
                "user".to_string(),
                "user/v1/user.proto".to_string(),
                NodeDetails::Service {
                    methods: vec![MethodSignature {
                        name: "GetUser".to_string(),
                        input_type: "GetUserRequest".to_string(),
                        output_type: "GetUserResponse".to_string(),
                    }],
                },
            )],
            edges: vec![Edge::new(
                "user.v1/user".to_string(),
                "google.protobuf/timestamp".to_string(),
            )],
            packages: vec![Package::new(
                "user.v1".to_string(),
                "user.v1".to_string(),
                vec!["user.v1/user".to_string()],
            )],
        }
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let router = create_router(test_graph());

        let request = Request::builder()
            .uri("/health")
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
            .body(Body::empty())
            .unwrap();

        let response = router.oneshot(request).await.unwrap();
        let content_type = response.headers().get("content-type").unwrap();
        assert!(content_type.to_str().unwrap().contains("application/json"));
    }
}
