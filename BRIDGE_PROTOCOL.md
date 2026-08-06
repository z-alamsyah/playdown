# Playdown Remote Bridge — Protocol v1

The bridge is Playdown's local extension point: an opt-in **Unix domain
socket** that exposes the running terminal sessions (output, input, agent
status) to companion processes — e.g. [`playdown-remote`](https://github.com/z-alamsyah/playdown-remote).

- Socket: `~/.playdown/bridge.sock` (directory `0700`, same-user access only)
- Framing: **JSON Lines** — one JSON object per `\n`-terminated line, UTF-8
- Terminal data is base64-encoded raw PTY bytes (both directions)
- The bridge is OFF by default (Settings → Terminal & agents → Remote bridge)

## Client → Playdown

| op | fields | effect |
|---|---|---|
| `hello` | `v` (int) | handshake; server replies `hello` |
| `sessions` | — | server replies a `sessions` snapshot |
| `attach` | `id` | server replies `scrollback` for that session (~64KB replay) |
| `input` | `id`, `data` (b64) | write bytes to the session's PTY |
| `resize` | `id`, `cols`, `rows` | resize the PTY to the client's viewport (tmux-style "last client wins" — the desktop re-asserts its size when it next interacts) |
| `open` | `agent`? (bool) | ask Playdown to open a new terminal tab (runs the user's agent preset when `agent` is true). A request to the UI — the next `sessions` event confirms it. |
| `close` | `id` | ask Playdown to close that tab (kills the PTY, same as closing it in the UI) |

## Playdown → client

| ev | fields | meaning |
|---|---|---|
| `hello` | `v`, `app`, `version` | handshake reply |
| `sessions` | `sessions[]` | full session list — sent on connect, on reply, and whenever anything changes |
| `scrollback` | `id`, `data` (b64) | recent output replay after `attach` |
| `output` | `id`, `data` (b64) | live PTY output (all sessions; filter client-side) |
| `error` | `msg` | request failed |

`sessions[]` items: `{ id, label, title?, custom?, status }` where `status ∈ idle | working | blocked | done` (see the agent-status heuristics in Playdown).

## Notes for companion authors

- Treat `sessions` as the single source of truth for names/status; re-render on every event.
- Output events flow for **all** sessions on one socket — bandwidth is raw
  terminal text, negligible.
- The socket grants **shell input** to the user's sessions. Never re-expose it
  without authentication (token at minimum), and never bind your remote server
  publicly by default.
