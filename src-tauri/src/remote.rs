//! Supervised playdown-remote companion (Settings → Phone access).
//!
//! Playdown spawns the separately-installed `playdown-remote` binary with
//! `--json --parent-pid <us>`, reads its one-line ready handshake (URLs +
//! QR art), and kills it on toggle-off or app exit. The companion's own
//! parent watchdog covers crashes, so no orphaned server ever survives.

use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Default)]
pub struct Companion(pub Mutex<Option<Child>>);

/// Kill + reap the supervised companion (idempotent).
pub fn shutdown(slot: &Companion) {
    if let Some(mut child) = slot.0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait(); // reap — no zombies
    }
}

fn find_binary() -> Option<std::path::PathBuf> {
    let home = std::env::var("HOME").unwrap_or_default();
    for c in [
        format!("{home}/.local/bin/playdown-remote"),
        "/usr/local/bin/playdown-remote".to_string(),
        "/opt/homebrew/bin/playdown-remote".to_string(),
    ] {
        let p = std::path::PathBuf::from(&c);
        if p.is_file() {
            return Some(p);
        }
    }
    if let Ok(out) = Command::new("which").arg("playdown-remote").output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(s.into());
            }
        }
    }
    None
}

#[tauri::command]
pub fn remote_companion_installed() -> bool {
    find_binary().is_some()
}

#[tauri::command]
pub fn remote_companion_running(state: State<Companion>) -> bool {
    let mut slot = state.0.lock().unwrap();
    match slot.as_mut() {
        Some(c) => match c.try_wait() {
            Ok(None) => true,
            _ => {
                *slot = None;
                false
            }
        },
        None => false,
    }
}

#[tauri::command]
pub fn remote_companion_stop(state: State<Companion>) {
    shutdown(&state);
}

/// Spawn the companion and return its JSON ready line (urls + QR art).
#[tauri::command]
pub fn remote_companion_start(
    state: State<Companion>,
    extra_args: Option<String>,
) -> Result<String, String> {
    shutdown(&state); // restart semantics — a stale instance would hold the port

    let bin = find_binary().ok_or(
        "playdown-remote is not installed. Run:\n\
         curl -fsSL https://raw.githubusercontent.com/z-alamsyah/playdown-remote/main/install.sh | sh",
    )?;

    let mut cmd = Command::new(bin);
    cmd.arg("--json")
        .arg("--parent-pid")
        .arg(std::process::id().to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(extra) = extra_args {
        for a in extra.split_whitespace() {
            cmd.arg(a);
        }
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;

    // Drain stderr forever (a full pipe would block the companion); keep a
    // small tail for error reporting.
    let err_tail: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let err_tail2 = err_tail.clone();
    std::thread::spawn(move || {
        for line in std::io::BufReader::new(stderr).lines().map_while(Result::ok) {
            let mut t = err_tail2.lock().unwrap();
            t.push_str(&line);
            t.push('\n');
            if t.len() > 4096 {
                let cut = t.len() - 4096;
                let cut = t.char_indices().map(|(i, _)| i).find(|&i| i >= cut).unwrap_or(0);
                t.drain(..cut);
            }
        }
    });

    // First stdout line = ready handshake; keep draining afterwards.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let _ = reader.read_line(&mut line);
        let _ = tx.send(line);
        loop {
            let mut sink = String::new();
            match reader.read_line(&mut sink) {
                Ok(0) | Err(_) => break,
                _ => {}
            }
        }
    });

    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(line) if line.contains("\"ready\"") => {
            *state.0.lock().unwrap() = Some(child);
            Ok(line)
        }
        _ => {
            let _ = child.kill();
            let _ = child.wait();
            std::thread::sleep(std::time::Duration::from_millis(150)); // let the drain catch up
            let err = err_tail.lock().unwrap().trim().to_string();
            Err(if err.is_empty() {
                "playdown-remote did not start (port in use?)".into()
            } else {
                err
            })
        }
    }
}
