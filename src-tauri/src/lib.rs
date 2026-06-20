use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// A node in the markdown file tree returned to the frontend.
#[derive(Serialize)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileNode>>,
}

// Heavy / noise directories are still skipped even though dotfiles are shown.
const SKIP_DIRS: [&str; 8] = [
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".svelte-kit",
    ".next",
    ".cache",
];

/// Recursively build the full file tree (all files and folders, including
/// dotfiles like `.claude` / `.gitignore`). Only the heavy build/VCS
/// directories in `SKIP_DIRS` are pruned.
fn build_tree(dir: &Path) -> Vec<FileNode> {
    let read = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let mut paths: Vec<PathBuf> = read.filter_map(|e| e.ok().map(|e| e.path())).collect();
    paths.sort();

    let mut nodes: Vec<FileNode> = Vec::new();
    for path in paths {
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if path.is_dir() {
            if SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            let children = build_tree(&path);
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: true,
                children: Some(children),
            });
        } else {
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().into_owned(),
                is_dir: false,
                children: None,
            });
        }
    }

    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    nodes
}

#[tauri::command]
fn list_dir_tree(path: String) -> Result<Vec<FileNode>, String> {
    let p = Path::new(&path);
    if !p.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }
    Ok(build_tree(p))
}

#[tauri::command]
fn is_dir(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("A file with that name already exists".into());
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("A folder with that name already exists".into());
    }
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            list_dir_tree,
            is_dir,
            read_file,
            write_file,
            create_file,
            create_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
