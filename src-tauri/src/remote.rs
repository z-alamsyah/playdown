//! Supervised playdown-remote companion (Settings → Phone access).
//!
//! Playdown spawns the separately-installed `playdown-remote` binary with
//! `--json --parent-pid <us>`, reads its one-line ready handshake (URLs +
//! QR art), and kills it on toggle-off or app exit. The companion's own
//! parent watchdog covers crashes, so no orphaned server ever survives.

use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};

/// The running companion, kept with what it was started with and its latest
/// addresses so another window (or a reopened Settings) can show the same QR
/// instead of restarting it - a restart mints a new token and voids every
/// link already scanned.
pub struct Running {
    child: Child,
    args: Option<String>,
    /// Latest JSON line carrying `urls`: the ready line, then any updates.
    info: Arc<Mutex<String>>,
}

#[derive(Default)]
pub struct Companion(pub Mutex<Option<Running>>);

/// Kill + reap the supervised companion (idempotent).
pub fn shutdown(slot: &Companion) {
    if let Some(mut run) = slot.0.lock().unwrap().take() {
        let _ = run.child.kill();
        let _ = run.child.wait(); // reap — no zombies
    }
}

/// Is the companion in the slot still the one that owns `info`? (A pid could
/// be reused; the `info` handle is unique to each spawn.)
fn is_current(app: &tauri::AppHandle, info: &Arc<Mutex<String>>) -> bool {
    let state = app.state::<Companion>();
    let slot = state.0.lock().unwrap();
    slot.as_ref().is_some_and(|r| Arc::ptr_eq(&r.info, info))
}

/// Take the companion out of the slot if it is still the one owning `info`.
fn take_if(app: &tauri::AppHandle, info: &Arc<Mutex<String>>) -> Option<Running> {
    let state = app.state::<Companion>();
    let mut slot = state.0.lock().unwrap();
    if slot.as_ref().is_some_and(|r| Arc::ptr_eq(&r.info, info)) {
        slot.take()
    } else {
        None
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
        Some(r) => match r.child.try_wait() {
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
pub fn remote_companion_stop(app: tauri::AppHandle, state: State<Companion>) {
    shutdown(&state);
    // Other windows still show the old QR; tell them it is gone.
    let _ = app.emit("remote://companion-exit", ());
}

/// Spawn the companion and return its JSON ready line (urls + QR art).
#[tauri::command]
pub fn remote_companion_start(
    app: tauri::AppHandle,
    state: State<Companion>,
    extra_args: Option<String>,
    restart: Option<bool>,
) -> Result<String, String> {
    // Every window asks for the companion when it loads. Hand back the live
    // one unless asked to restart (or the arguments changed).
    if !restart.unwrap_or(false) {
        let mut slot = state.0.lock().unwrap();
        if let Some(run) = slot.as_mut() {
            if run.args == extra_args && matches!(run.child.try_wait(), Ok(None)) {
                return Ok(run.info.lock().unwrap().clone());
            }
        }
    }
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
    if let Some(extra) = &extra_args {
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

    // First stdout line = ready handshake. Later lines carrying `urls` are
    // address changes (Tailscale or Wi-Fi coming up after start): keep them
    // and pass them to every window. EOF means the companion exited.
    let info: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let info2 = info.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    let (filed_tx, filed_rx) = std::sync::mpsc::channel::<()>();
    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stdout);
        let mut line = String::new();
        let _ = reader.read_line(&mut line);
        *info2.lock().unwrap() = line.clone();
        let _ = tx.send(line);
        // Wait until the child is in the slot (or start gave up on it), so an
        // instant exit below can't miss it.
        let _ = filed_rx.recv();
        loop {
            let mut next = String::new();
            match reader.read_line(&mut next) {
                Ok(0) | Err(_) => break,
                _ => {}
            }
            if next.contains("\"urls\"") && is_current(&app, &info2) {
                *info2.lock().unwrap() = next.clone();
                let _ = app.emit("remote://companion", next);
            }
        }
        // It exited on its own (Disconnect, crash): reap it now rather than
        // leave a zombie until remote access is turned off, and tell the UI
        // its QR is dead. A companion we replaced or stopped is not ours to
        // report.
        if let Some(mut run) = take_if(&app, &info2) {
            let _ = run.child.kill(); // already gone in practice
            let _ = run.child.wait();
            let _ = app.emit("remote://companion-exit", ());
        }
    });

    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(line) if line.contains("\"ready\"") => {
            *state.0.lock().unwrap() = Some(Running { child, args: extra_args, info });
            let _ = filed_tx.send(());
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
