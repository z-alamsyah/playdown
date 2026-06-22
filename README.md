# 📝 Playdown

A lightweight, cross-platform **markdown editor & viewer** built with [Tauri v2](https://tauri.app) + [Svelte 5](https://svelte.dev).

Built for people who live in markdown all day — skills, agents, PRDs, manifests — and don't want a full IDE eating hundreds of MB of RAM just to read a `.md` file.

| | Playdown | Typical code editor |
|---|---|---|
| App bundle | ~5 MB | 100+ MB |
| RAM (idle) | ~70–100 MB | 300–500+ MB |
| Startup | < 0.5s | 1–3s |

🌐 **[Landing page & download →](https://z-alamsyah.github.io/playdown/)**

## Install

### macOS — one line (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/z-alamsyah/playdown/main/install.sh | bash
```

This downloads the latest `.dmg`, copies **Playdown** to `/Applications`, clears the quarantine flag (the app is unsigned), and launches it.

### macOS — manual (.dmg)

1. Download the latest `.dmg` from [Releases](https://github.com/z-alamsyah/playdown/releases/latest).
2. Open it, drag **Playdown** → **Applications**.
3. First launch only: right-click **Playdown** → **Open** (it's unsigned, so Gatekeeper asks once).

### Windows / Linux

Grab the installer for your platform from [Releases](https://github.com/z-alamsyah/playdown/releases/latest) (`.msi` / `.AppImage` / `.deb`), produced by the release CI.

### From source

```bash
git clone https://github.com/z-alamsyah/playdown.git
cd playdown
pnpm install
pnpm tauri build      # bundle for your OS
# or: pnpm tauri dev   # run in dev mode
```

## Features

- 📂 **Folder tree** — open a folder (or drag one onto the window); shows all files including dotfiles, with nested indent guides
- 🗂️ **Tabs** — open multiple files; drag tabs to reorder or move between groups
- 🪟 **Split panes** — VSCode-style: drag a tab to a pane edge to split (row/column, nested), resizable dividers; `⌘\` splits right
- ✏️ **Edit ⇄ Preview** — per-pane toggle (top-right of each group); edit on the left, live preview on the right
- 🔎 **Quick Open** — `⌘P` fuzzy file finder
- 🔦 **Find / replace** — `⌘F` in the editor (CodeMirror search)
- 🧭 **Outline** — headings of the active file in a panel opposite the sidebar; click to jump
- 🧩 **Frontmatter-aware** — YAML frontmatter highlighted & foldable in the editor, rendered as a metadata card in preview
- ✨ **GFM** — tables, task lists, code syntax highlighting
- 🧜 **Mermaid** — diagrams rendered in preview (lazy-loaded)
- 🔡 **JSON** — syntax highlighting, `⌘⇧F` to format/pretty-print, highlighted JSON preview
- 🖼️ **Image preview** — png/jpg/gif/webp/svg/bmp/ico/avif rendered inline
- 🗃️ **File ops** — new file / new folder (sidebar buttons or right-click), rename (right-click or `Enter` on a selection), delete to Trash, copy full / relative path (right-click or select + `⌘C`)
- 🖥️ **Built-in terminal** — multi-session, VSCode-style management (new / switch / kill), resizable bottom panel, `` Ctrl+` `` to toggle (xterm.js lazy-loaded — zero idle cost)
- ⌨️ **`playdown` CLI** — `playdown .` opens a folder from your terminal; `playdown --version` / `--help` (install from Settings → Command line)
- 🔍 **Zoom** — `⌘=` / `⌘-` / `⌘0` or trackpad pinch
- ⚙️ **Settings** (`⌘,`) — theme, sidebar side (left/right), zoom, and **fully rebindable shortcuts**
- 🌗 **Dark / light themes**, window state, and full session (layout + open tabs) persisted across restarts
- 🆓 **No sign-in, free forever** — no account, no telemetry, no subscription. Open source (MIT)

## Keyboard shortcuts

All shortcuts are rebindable in Settings (`⌘,`). Defaults:

| Shortcut | Action |
|---|---|
| `⌘P` | Quick open (find file) |
| `⌘F` | Find / replace in editor |
| `⌘O` | Open folder |
| `⌘S` | Save |
| `⌘E` | Toggle edit / preview |
| `⌘\` | Split right |
| `⌘B` | Toggle sidebar |
| `⌘⇧O` | Toggle outline |
| `⌘⇧F` | Format JSON |
| `` Ctrl+` `` | Toggle terminal |
| `⌘W` | Close tab |
| `⌘1`–`⌘9` | Select tab |
| `Ctrl+Tab` / `Ctrl+⇧+Tab` | Cycle tabs |
| `⌘⌥←` / `⌘⌥→` | Focus previous / next split group |
| `⌘=` / `⌘-` / `⌘0` | Zoom in / out / reset |
| `⌘,` | Settings |

## Development

Prerequisites: [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io) + [Rust](https://rustup.rs).

```bash
pnpm install
pnpm tauri dev      # run the app in dev mode
pnpm tauri build    # produce a distributable bundle (.app / .dmg / …)
```

## Tech

- **Shell:** Tauri v2 (Rust core, system WebView — no bundled Chromium)
- **UI:** Svelte 5 + Vite + TypeScript
- **Editor:** CodeMirror 6
- **Rendering:** markdown-it + highlight.js + mermaid

## License

MIT
