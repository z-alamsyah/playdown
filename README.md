# 📝 Playdown

A lightweight, cross-platform **markdown editor & viewer** built with [Tauri v2](https://tauri.app) + [Svelte 5](https://svelte.dev).

Built for people who live in markdown all day — skills, agents, PRDs, manifests — and don't want a full IDE eating hundreds of MB of RAM just to read a `.md` file.

| | Playdown | Typical code editor |
|---|---|---|
| Binary | ~6 MB | 100+ MB |
| RAM (idle) | ~70–100 MB | 300–500+ MB |
| Startup | < 0.5s | 1–3s |

## Features

- 📂 **Folder tree** — open a folder, browse all markdown recursively
- 🗂️ **Tabs** — open multiple files at once
- ✏️ **Edit ⇄ Preview** — toggle with `⌘E` (single-pane, distraction-free)
- 🧩 **Frontmatter-aware** — YAML frontmatter is highlighted & foldable in the editor and rendered as a metadata card in preview
- ✨ **GFM** — tables, task lists, code syntax highlighting
- 🧜 **Mermaid** — diagrams rendered in preview (lazy-loaded)
- 🌗 **Dark / light themes** — persisted across restarts
- 💾 Remembers your last folder, open tabs, and view mode

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘/Ctrl + O` | Open folder |
| `⌘/Ctrl + B` | Toggle sidebar |
| `⌘/Ctrl + E` | Toggle edit / preview |
| `⌘/Ctrl + S` | Save |
| `⌘/Ctrl + W` | Close tab |

## Development

Prerequisites: [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io) + [Rust](https://rustup.rs).

```bash
pnpm install
pnpm tauri dev      # run the app in dev mode
pnpm tauri build    # produce a distributable bundle
```

## Tech

- **Shell:** Tauri v2 (Rust core, system WebView — no bundled Chromium)
- **UI:** Svelte 5 + Vite + TypeScript
- **Editor:** CodeMirror 6
- **Rendering:** markdown-it + highlight.js + mermaid

## License

MIT
