//! Remote Bridge — Playdown's local extension point (see BRIDGE_PROTOCOL.md).
//!
//! An opt-in Unix domain socket exposing terminal sessions (output, input,
//! agent status) to same-user companion processes like `playdown-remote`.
//! JSON-lines framing; PTY data is base64. Unix-only for now.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use tokio::sync::broadcast;

use crate::terminal::TerminalState;

pub const PROTOCOL_VERSION: u32 = 1;
const SCROLLBACK_CAP: usize = 64 * 1024;

#[derive(Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom: Option<String>,
    pub status: String,
}

pub struct BridgeHub {
    /// Live PTY output, tee'd from the reader threads: (session id, bytes).
    output_tx: broadcast::Sender<(String, Vec<u8>)>,
    /// Pre-serialized JSON-line events (session list changes).
    event_tx: broadcast::Sender<String>,
    sessions: Mutex<Vec<SessionInfo>>,
    scrollback: Mutex<HashMap<String, Vec<u8>>>,
    server: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl Default for BridgeHub {
    fn default() -> Self {
        Self {
            output_tx: broadcast::channel(256).0,
            event_tx: broadcast::channel(64).0,
            sessions: Mutex::new(Vec::new()),
            scrollback: Mutex::new(HashMap::new()),
            server: Mutex::new(None),
        }
    }
}

pub type Hub = Arc<BridgeHub>;

/// Called from the PTY reader threads (sync context) for every chunk.
pub fn push_output(hub: &Hub, id: &str, data: &[u8]) {
    {
        let mut sb = hub.scrollback.lock().unwrap();
        let buf = sb.entry(id.to_string()).or_default();
        buf.extend_from_slice(data);
        if buf.len() > SCROLLBACK_CAP {
            let excess = buf.len() - SCROLLBACK_CAP;
            buf.drain(..excess);
        }
    }
    let _ = hub.output_tx.send((id.to_string(), data.to_vec()));
}

/// Called when a session closes — drop its replay buffer.
pub fn drop_session(hub: &Hub, id: &str) {
    hub.scrollback.lock().unwrap().remove(id);
}

fn socket_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    Ok(std::path::Path::new(&home).join(".playdown").join("bridge.sock"))
}

fn sessions_event(sessions: &[SessionInfo]) -> String {
    json!({ "ev": "sessions", "sessions": sessions }).to_string()
}

/// Frontend pushes the authoritative session list (names + agent status)
/// whenever anything changes; the bridge fans it out to companions.
#[tauri::command]
pub fn bridge_sync(hub: State<Hub>, sessions: Vec<SessionInfo>) {
    *hub.sessions.lock().unwrap() = sessions.clone();
    let _ = hub.event_tx.send(sessions_event(&sessions));
}

// Async so the body runs inside Tauri's tokio runtime —
// tokio::net::UnixListener::from_std panics without a reactor.
#[tauri::command]
pub async fn bridge_start(
    app: tauri::AppHandle,
    hub: State<'_, Hub>,
    term: State<'_, TerminalState>,
) -> Result<String, String> {
    let _ = &app; // used on unix only
    #[cfg(not(unix))]
    {
        return Err("The remote bridge is only available on macOS/Linux for now.".into());
    }
    #[cfg(unix)]
    {
        let mut server = hub.server.lock().unwrap();
        let path = socket_path()?;
        if server.is_some() {
            return Ok(path.to_string_lossy().into_owned());
        }
        let dir = path.parent().unwrap().to_path_buf();
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
        }
        let _ = std::fs::remove_file(&path); // stale socket from a previous run
        let listener =
            std::os::unix::net::UnixListener::bind(&path).map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let listener =
            tokio::net::UnixListener::from_std(listener).map_err(|e| e.to_string())?;

        let hub2: Hub = hub.inner().clone();
        let term2: TerminalState = term.inner().clone();
        let app2 = app.clone();
        *server = Some(tauri::async_runtime::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        let hub3 = hub2.clone();
                        let term3 = term2.clone();
                        let app3 = app2.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = serve_client(stream, hub3, term3, app3).await;
                        });
                    }
                    Err(_) => break,
                }
            }
        }));
        Ok(path.to_string_lossy().into_owned())
    }
}

#[tauri::command]
pub fn bridge_stop(hub: State<Hub>) {
    if let Some(handle) = hub.server.lock().unwrap().take() {
        handle.abort();
    }
    if let Ok(path) = socket_path() {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(unix)]
async fn serve_client(
    stream: tokio::net::UnixStream,
    hub: Hub,
    term: TerminalState,
    app: tauri::AppHandle,
) -> Result<(), std::io::Error> {
    use base64::Engine;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let (read_half, mut write) = stream.into_split();
    let mut lines = BufReader::new(read_half).lines();
    let mut output_rx = hub.output_tx.subscribe();
    let mut event_rx = hub.event_tx.subscribe();
    let b64 = base64::engine::general_purpose::STANDARD;

    // Greet + initial snapshot.
    let hello = json!({
        "ev": "hello", "v": PROTOCOL_VERSION,
        "app": "playdown", "version": env!("CARGO_PKG_VERSION"),
    });
    write.write_all(format!("{hello}\n").as_bytes()).await?;
    let snapshot = sessions_event(&hub.sessions.lock().unwrap().clone());
    write.write_all(format!("{snapshot}\n").as_bytes()).await?;

    loop {
        tokio::select! {
            line = lines.next_line() => {
                let Ok(Some(line)) = line else { break };
                let Ok(req) = serde_json::from_str::<serde_json::Value>(&line) else {
                    write.write_all(b"{\"ev\":\"error\",\"msg\":\"bad json\"}\n").await?;
                    continue;
                };
                match req["op"].as_str().unwrap_or("") {
                    "hello" => { /* greeted already */ }
                    "sessions" => {
                        let ev = sessions_event(&hub.sessions.lock().unwrap().clone());
                        write.write_all(format!("{ev}\n").as_bytes()).await?;
                    }
                    "attach" => {
                        if let Some(id) = req["id"].as_str() {
                            let data = hub.scrollback.lock().unwrap().get(id).cloned().unwrap_or_default();
                            let ev = json!({ "ev": "scrollback", "id": id, "data": b64.encode(&data) });
                            write.write_all(format!("{ev}\n").as_bytes()).await?;
                        }
                    }
                    "input" => {
                        let (Some(id), Some(data)) = (req["id"].as_str(), req["data"].as_str()) else { continue };
                        let Ok(bytes) = b64.decode(data) else { continue };
                        if term.write_bytes(id, &bytes).is_err() {
                            write.write_all(b"{\"ev\":\"error\",\"msg\":\"write failed\"}\n").await?;
                        }
                    }
                    "resize" => {
                        let (Some(id), Some(cols), Some(rows)) =
                            (req["id"].as_str(), req["cols"].as_u64(), req["rows"].as_u64())
                        else { continue };
                        let _ = term.resize_pty(id, cols.min(500) as u16, rows.min(300) as u16);
                    }
                    // Tab management is a REQUEST to the frontend — sessions
                    // are owned by the UI (xterm lifecycle, tab state), so the
                    // bridge can't create them itself. The frontend confirms
                    // via the next `sessions` event.
                    "open" => {
                        let agent = req["agent"].as_bool().unwrap_or(false);
                        let _ = app.emit("bridge://open", json!({ "agent": agent }));
                    }
                    "close" => {
                        if let Some(id) = req["id"].as_str() {
                            let _ = app.emit("bridge://close", id);
                        }
                    }
                    _ => {
                        write.write_all(b"{\"ev\":\"error\",\"msg\":\"unknown op\"}\n").await?;
                    }
                }
            }
            out = output_rx.recv() => {
                match out {
                    Ok((id, data)) => {
                        let ev = json!({ "ev": "output", "id": id, "data": b64.encode(&data) });
                        write.write_all(format!("{ev}\n").as_bytes()).await?;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
            ev = event_rx.recv() => {
                match ev {
                    Ok(line) => write.write_all(format!("{line}\n").as_bytes()).await?,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
        }
    }
    Ok(())
}
