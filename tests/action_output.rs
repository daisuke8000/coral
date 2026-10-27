#![cfg(unix)]

use std::fs;
use std::os::unix::fs::symlink;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT: AtomicUsize = AtomicUsize::new(0);

struct Workspace(PathBuf);
impl Workspace {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "coral-output-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        Self(root)
    }
    fn prepare(&self) -> bool {
        Command::new("bash")
            .arg(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/scripts/prepare-output.sh"
            ))
            .arg(&self.0)
            .output()
            .unwrap()
            .status
            .success()
    }
}
impl Drop for Workspace {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn rejects_output_links_without_touching_external_files() {
    for path in [
        "coral-output",
        "coral-output/graph.json",
        "coral-output/base.json",
        "coral-output/html",
        "coral-output/html/assets/escape",
    ] {
        let workspace = Workspace::new();
        let outside = Workspace::new();
        let sentinel = outside.0.join("sentinel");
        fs::write(&sentinel, "unchanged").unwrap();
        let link = workspace.0.join(path);
        fs::create_dir_all(link.parent().unwrap()).unwrap();
        let target = if path.ends_with("graph.json") || path.ends_with("base.json") {
            &sentinel
        } else {
            &outside.0
        };
        symlink(target, &link).unwrap();
        assert!(!workspace.prepare(), "accepted {path}");
        assert_eq!(fs::read_to_string(sentinel).unwrap(), "unchanged");
    }
    let workspace = Workspace::new();
    fs::create_dir(workspace.0.join("coral-output")).unwrap();
    symlink(
        workspace.0.join("missing"),
        workspace.0.join("coral-output/graph.json"),
    )
    .unwrap();
    assert!(!workspace.prepare());
    assert!(!workspace.0.join("missing").exists());
}

#[test]
fn repeated_pages_publication_preserves_paths_and_replaces_stale_content() {
    let workspace = Workspace::new();
    let action = Workspace::new();
    fs::create_dir_all(action.0.join("scripts")).unwrap();
    fs::copy(
        concat!(env!("CARGO_MANIFEST_DIR"), "/scripts/prepare-output.sh"),
        action.0.join("scripts/prepare-output.sh"),
    )
    .unwrap();
    fs::create_dir_all(action.0.join("ui/dist")).unwrap();
    assert!(workspace.prepare());
    fs::write(workspace.0.join("coral-output/graph.json"), "{}").unwrap();
    // Execute the actual publication step, not a duplicate of its implementation.
    let action_yaml = include_str!("../action.yml");
    let pages = action_yaml
        .split("    - name: Generate GitHub Pages\n")
        .nth(1)
        .unwrap()
        .split("    - name:")
        .next()
        .unwrap();
    let script = pages
        .split("      run: |\n")
        .nth(1)
        .unwrap()
        .lines()
        .map(|line| line.strip_prefix("        ").unwrap_or(line))
        .collect::<Vec<_>>()
        .join("\n");
    for text in ["first", "second"] {
        fs::write(action.0.join("ui/dist/index.html"), text).unwrap();
        let result = Command::new("bash")
            .args(["-euo", "pipefail", "-c", &script])
            .env("ACTION_PATH", &action.0)
            .env("GITHUB_WORKSPACE", &workspace.0)
            .env("GITHUB_OUTPUT", workspace.0.join("outputs"))
            .current_dir(&workspace.0)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
        assert_eq!(
            fs::read_to_string(workspace.0.join("coral-output/html/index.html")).unwrap(),
            text
        );
        assert_eq!(
            fs::read_to_string(workspace.0.join("coral-output/html/graph.json")).unwrap(),
            "{}"
        );
        assert!(!workspace.0.join("coral-output/html/dist").exists());
        assert!(workspace.prepare());
    }
}
