use base64::Engine;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

/// Arc-shared so the remote bridge's socket tasks can write to PTYs too.
#[derive(Default, Clone)]
pub struct TerminalState(Arc<Mutex<HashMap<String, Session>>>);

impl TerminalState {
    /// Write raw bytes to a session's PTY (used by term_write and the bridge).
    pub fn write_bytes(&self, id: &str, data: &[u8]) -> Result<(), String> {
        let mut map = self.0.lock().unwrap();
        let s = map.get_mut(id).ok_or_else(|| format!("no session {id}"))?;
        s.writer.write_all(data).map_err(|e| e.to_string())?;
        s.writer.flush().map_err(|e| e.to_string())
    }

    /// Resize a session's PTY (used by term_resize and the bridge — remote
    /// clients resize to their own viewport, tmux-style "last client wins").
    pub fn resize_pty(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let map = self.0.lock().unwrap();
        let s = map.get(id).ok_or_else(|| format!("no session {id}"))?;
        s.master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())
    }
}

fn default_shell_path() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".into()
        } else {
            "/bin/zsh".into()
        }
    })
}

/// Basename of the user's shell (for tab labels).
#[tauri::command]
pub fn default_shell() -> String {
    let s = default_shell_path();
    s.rsplit(['/', '\\']).next().unwrap_or("shell").to_string()
}

/// Spawn a shell in a new PTY; stream its output via `term://{id}` events.
#[tauri::command]
pub fn term_open(
    app: AppHandle,
    state: State<TerminalState>,
    hub: State<crate::bridge::Hub>,
    id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell_path());
    // Spawn a login shell so it sources the user's profile (~/.zprofile etc.).
    // A GUI app inherits launchd's minimal PATH, so without this, Homebrew tools
    // (tmux, etc.) in /opt/homebrew/bin wouldn't resolve. Matches Terminal.app.
    #[cfg(unix)]
    cmd.arg("-l");
    if let Some(dir) = cwd {
        if std::path::Path::new(&dir).is_dir() {
            cmd.cwd(dir);
        }
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let app2 = app.clone();
    let hub2 = hub.inner().clone();
    let sid = id.clone();
    let out_event = format!("term://{id}");
    let exit_event = format!("term-exit://{id}");
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    // Emit raw bytes (base64) — decoding UTF-8 per chunk would
                    // corrupt multi-byte glyphs split across read boundaries.
                    // xterm.write(Uint8Array) decodes statefully across writes.
                    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    let _ = app2.emit(&out_event, b64);
                    // Tee to the remote bridge (scrollback + live stream).
                    crate::bridge::push_output(&hub2, &sid, &buf[..n]);
                }
            }
        }
        let _ = app2.emit(&exit_event, ());
    });

    state.0.lock().unwrap().insert(
        id,
        Session {
            master: pair.master,
            writer,
            child,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn term_write(state: State<TerminalState>, id: String, data: String) -> Result<(), String> {
    // Ignore "no session" (a late write after close is harmless).
    let _ = state.write_bytes(&id, data.as_bytes());
    Ok(())
}

#[tauri::command]
pub fn term_resize(
    state: State<TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let _ = state.resize_pty(&id, cols, rows); // late resize after close is harmless
    Ok(())
}

#[tauri::command]
pub fn term_close(
    state: State<TerminalState>,
    hub: State<crate::bridge::Hub>,
    id: String,
) -> Result<(), String> {
    if let Some(mut s) = state.0.lock().unwrap().remove(&id) {
        let _ = s.child.kill();
    }
    crate::bridge::drop_session(&hub, &id);
    Ok(())
}
