fn main() {
    let manifest_dir =
        std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir
        .parent()
        .expect("src-tauri must be inside the repository");
    for script in [
        "scripts/sync-prose-assessment-manifest.mjs",
        "scripts/sync-lesson-helper-manifest.mjs",
        "scripts/sync-opener-scope.mjs",
    ] {
        let status = std::process::Command::new("node")
            .arg(repo_root.join(script))
            .arg("--check")
            .current_dir(repo_root)
            .status()
            .unwrap_or_else(|error| panic!("could not run {script}: {error}"));
        assert!(
            status.success(),
            "{script} reported stale generated course authority"
        );
    }
    println!("cargo:rerun-if-changed=../src/content");
    println!("cargo:rerun-if-changed=../agent-knowledge/resources");
    println!("cargo:rerun-if-changed=../scripts/sync-prose-assessment-manifest.mjs");
    println!("cargo:rerun-if-changed=../scripts/sync-lesson-helper-manifest.mjs");
    println!("cargo:rerun-if-changed=../scripts/sync-opener-scope.mjs");
    println!("cargo:rerun-if-changed=prose-assessment-manifest.json");
    println!("cargo:rerun-if-changed=lesson-helper-manifest.json");
    println!("cargo:rerun-if-changed=capabilities/default.json");
    tauri_build::build()
}
