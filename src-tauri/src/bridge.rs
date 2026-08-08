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

/// Per-session replay state: output ring + tracked DEC private modes.
///
/// TUIs enable mouse tracking / the alternate screen ONCE at startup; when a
/// remote client attaches later, those DECSET sequences have usually scrolled
/// out of the 64KB ring, so its xterm would never learn the modes (taps not
/// forwarded as clicks, scroll misrouted). We track `ESC [ ? n h/l` in the
/// stream and append a synthetic restore suffix to every attach replay.
#[derive(Default)]
struct SessionBuf {
    data: Vec<u8>,
    modes: std::collections::BTreeMap<u16, bool>,
    /// Tail of the previous chunk — a sequence can split across reads.
    carry: Vec<u8>,
}

pub struct BridgeHub {
    /// Live PTY output, tee'd from the reader threads: (session id, bytes).
    output_tx: broadcast::Sender<(String, Vec<u8>)>,
    /// Pre-serialized JSON-line events (session list changes).
    event_tx: broadcast::Sender<String>,
    sessions: Mutex<Vec<SessionInfo>>,
    scrollback: Mutex<HashMap<String, SessionBuf>>,
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

/// Scan for DEC private mode changes (`ESC [ ? n(;n)* h|l`) and record them.
fn scan_modes(buf: &[u8], modes: &mut std::collections::BTreeMap<u16, bool>) {
    let mut i = 0;
    while i + 3 < buf.len() {
        if buf[i] == 0x1b && buf[i + 1] == b'[' && buf[i + 2] == b'?' {
            let mut j = i + 3;
            let mut params: Vec<u16> = Vec::new();
            let mut cur: u32 = 0;
            let mut has = false;
            while j < buf.len() {
                match buf[j] {
                    b'0'..=b'9' => {
                        cur = (cur * 10 + (buf[j] - b'0') as u32).min(65535);
                        has = true;
                        j += 1;
                    }
                    b';' => {
                        if has {
                            params.push(cur as u16);
                        }
                        cur = 0;
                        has = false;
                        j += 1;
                    }
                    b'h' | b'l' => {
                        if has {
                            params.push(cur as u16);
                        }
                        let v = buf[j] == b'h';
                        for p in &params {
                            modes.insert(*p, v);
                        }
                        i = j;
                        break;
                    }
                    _ => break,
                }
            }
        }
        i += 1;
    }
}

/// Synthetic sequence restoring the tracked mode state (diffs from defaults).
fn mode_restore(modes: &std::collections::BTreeMap<u16, bool>) -> Vec<u8> {
    let mut out = Vec::new();
    for (p, v) in modes {
        let default_on = matches!(p, 7 | 12 | 25); // wrap, blink, cursor visible
        if *v != default_on {
            out.extend_from_slice(format!("\x1b[?{}{}", p, if *v { 'h' } else { 'l' }).as_bytes());
        }
    }
    out
}

/// Called from the PTY reader threads (sync context) for every chunk.
pub fn push_output(hub: &Hub, id: &str, data: &[u8]) {
    {
        let mut sb = hub.scrollback.lock().unwrap();
        let buf = sb.entry(id.to_string()).or_default();
        // Mode scan over carry+chunk so split sequences are still seen.
        let mut scan = std::mem::take(&mut buf.carry);
        scan.extend_from_slice(data);
        scan_modes(&scan, &mut buf.modes);
        let keep = scan.len().min(16);
        buf.carry = scan[scan.len() - keep..].to_vec();

        buf.data.extend_from_slice(data);
        if buf.data.len() > SCROLLBACK_CAP {
            let excess = buf.data.len() - SCROLLBACK_CAP;
            buf.data.drain(..excess);
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
                            // Ring + synthetic mode restore: the client's
                            // terminal ends up with the app's CURRENT modes
                            // (mouse tracking, alt screen, …) even when the
                            // DECSETs scrolled out of the ring long ago.
                            let data = {
                                let sb = hub.scrollback.lock().unwrap();
                                match sb.get(id) {
                                    Some(buf) => {
                                        let mut d = buf.data.clone();
                                        d.extend_from_slice(&mode_restore(&buf.modes));
                                        d
                                    }
                                    None => Vec::new(),
                                }
                            };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_set_and_reset_across_chunks() {
        let mut m = std::collections::BTreeMap::new();
        // mouse + SGR + alt screen on, then bracketed paste on
        scan_modes(b"\x1b[?1000h\x1b[?1006h\x1b[?1049h", &mut m);
        scan_modes(b"\x1b[?2004h", &mut m);
        // sequence split across chunks: ESC [ ? 10  |  02 h
        let mut scan = b"\x1b[?10".to_vec();
        scan.extend_from_slice(b"02h");
        scan_modes(&scan, &mut m);
        // later the app turns mouse off
        scan_modes(b"\x1b[?1000l", &mut m);
        assert_eq!(m.get(&1000), Some(&false));
        assert_eq!(m.get(&1002), Some(&true));
        assert_eq!(m.get(&1006), Some(&true));
        assert_eq!(m.get(&1049), Some(&true));
        assert_eq!(m.get(&2004), Some(&true));
    }

    #[test]
    fn multi_param_and_restore_diffs_only() {
        let mut m = std::collections::BTreeMap::new();
        scan_modes(b"\x1b[?1002;1006h\x1b[?25l", &mut m);
        let out = String::from_utf8(mode_restore(&m)).unwrap();
        assert!(out.contains("\x1b[?1002h"));
        assert!(out.contains("\x1b[?1006h"));
        assert!(out.contains("\x1b[?25l")); // cursor hidden differs from default
        // 1000 was never seen — nothing emitted for it
        assert!(!out.contains("1000"));
    }

    #[test]
    fn default_states_not_emitted() {
        let mut m = std::collections::BTreeMap::new();
        scan_modes(b"\x1b[?25h\x1b[?1000h\x1b[?1000l", &mut m);
        let out = String::from_utf8(mode_restore(&m)).unwrap();
        assert!(out.is_empty(), "back-to-default modes must emit nothing, got {out:?}");
    }
}
