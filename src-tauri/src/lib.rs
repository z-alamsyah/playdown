mod terminal;

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

/// The folder path passed on the command line at launch (`playdown <path>`).
struct LaunchPath(Option<String>);

/// Resolve the first directory argument from an argv list.
fn dir_arg(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-') && Path::new(a).is_dir())
        .cloned()
}

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

/// Pick a non-colliding path in `dir` for `name`, appending " (n)" before the
/// extension if needed.
fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let np = Path::new(name);
    let stem = np.file_stem().and_then(|s| s.to_str()).unwrap_or(name);
    let ext = np.extension().and_then(|s| s.to_str());
    let mut i = 1;
    loop {
        let fname = match ext {
            Some(e) => format!("{stem} ({i}).{e}"),
            None => format!("{stem} ({i})"),
        };
        let cand = dir.join(fname);
        if !cand.exists() {
            return cand;
        }
        i += 1;
    }
}

/// Import an external file (dropped from Finder/Explorer) into `dir`, writing
/// the given base64 bytes. Auto-suffixes the name on collision; returns the
/// final path.
#[tauri::command]
fn import_file(dir: String, name: String, data_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| e.to_string())?;
    let dir_p = Path::new(&dir);
    if !dir_p.is_dir() {
        return Err(format!("Not a directory: {dir}"));
    }
    let dest = unique_path(dir_p, &name);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Move a file or folder to the OS trash (recoverable).
#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

/// Rename (or move) a file/folder.
#[tauri::command]
fn rename_path(from: String, to: String) -> Result<(), String> {
    if Path::new(&to).exists() {
        return Err("A file or folder with that name already exists".into());
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

/// Read an image and return it as a base64 data URL (reliable on any path).
#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    use base64::Engine;
    let p = Path::new(&path);
    let meta = fs::metadata(p).map_err(|e| e.to_string())?;
    if meta.len() > 25 * 1024 * 1024 {
        return Err("Image too large to preview (>25 MB)".into());
    }
    let bytes = fs::read(p).map_err(|e| e.to_string())?;
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

#[tauri::command]
fn get_launch_path(state: tauri::State<LaunchPath>) -> Option<String> {
    state.0.clone()
}

#[cfg(unix)]
#[tauri::command]
fn install_cli() -> Result<String, String> {
    use std::os::unix::fs::PermissionsExt;
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let script = "#!/bin/sh\n\
BIN=\"/Applications/Playdown.app/Contents/MacOS/playdown\"\n\
case \"$1\" in\n\
  --version|-v|--help|-h|--update) exec \"$BIN\" \"$1\" ;;\n\
esac\n\
target=\"${1:-.}\"\n\
abs=$(cd \"$target\" 2>/dev/null && pwd) || abs=\"$target\"\n\
open -a Playdown --args \"$abs\"\n";
    let candidates = [
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        format!("{home}/.local/bin"),
    ];
    for dir in candidates {
        let _ = fs::create_dir_all(&dir);
        if !Path::new(&dir).is_dir() {
            continue;
        }
        let dest = format!("{dir}/playdown");
        if fs::write(&dest, script).is_ok() {
            let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o755));
            return Ok(dest);
        }
    }
    Err("No writable PATH dir (tried /opt/homebrew/bin, /usr/local/bin, ~/.local/bin)".into())
}

#[cfg(not(unix))]
#[tauri::command]
fn install_cli() -> Result<String, String> {
    Err("The 'playdown' command installer is macOS/Linux only.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch = LaunchPath(dir_arg(&std::env::args().collect::<Vec<_>>()));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(dir) = dir_arg(&argv) {
                let _ = app.emit("cli-open", dir);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(launch)
        .manage(terminal::TerminalState::default())
        .invoke_handler(tauri::generate_handler![
            list_dir_tree,
            is_dir,
            read_file,
            write_file,
            create_file,
            create_dir,
            import_file,
            delete_path,
            rename_path,
            read_image_data_url,
            get_launch_path,
            install_cli,
            terminal::default_shell,
            terminal::term_open,
            terminal::term_write,
            terminal::term_resize,
            terminal::term_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
