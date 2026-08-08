<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import { terminal } from "../stores/terminal.svelte";

  let { id, active }: { id: string; active: boolean } = $props();

  let el: HTMLDivElement;
  // xterm is lazy-loaded, so keep these loosely typed.
  let term: any;
  let fit: any;
  let renderer: any;
  let unlistenOut: UnlistenFn | undefined;
  let unlistenExit: UnlistenFn | undefined;
  let ro: ResizeObserver | undefined;
  let onWinResize: (() => void) | undefined;
  let onWinFocus: (() => void) | undefined;
  let fitTimer: ReturnType<typeof setTimeout> | undefined;
  let ready = $state(false);

  // Debounce fits so dragging the panel doesn't flood the PTY with SIGWINCH
  // (which makes TUIs like Claude Code redraw repeatedly and leave artifacts).
  function scheduleFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
      if (active) doFit();
    }, 120);
  }

  function waitForSize(node: HTMLElement, timeoutMs = 2000): Promise<void> {
    return new Promise((resolve) => {
      if (node.clientWidth > 0 && node.clientHeight > 0) return resolve();
      const obs = new ResizeObserver(() => {
        if (node.clientWidth > 0 && node.clientHeight > 0) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(node);
      setTimeout(() => {
        obs.disconnect();
        resolve();
      }, timeoutMs);
    });
  }

  // JuliaMono is bundled (lazy) for full glyph coverage — braille,
  // box-drawing, dingbats — so TUI spinners/borders render instead of tofu.
  const MONO = '"JuliaMono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const BASE_FONT = 13;

  // Counter the webview zoom so the terminal's on-screen size — and thus its
  // column count — stays constant regardless of app zoom. Keeps a running TUI
  // from reflowing/garbling when you zoom the app.
  function zoomedFont() {
    return Math.max(8, Math.round(BASE_FONT / settings.zoom));
  }

  function theme() {
    return settings.isDark
      ? { background: "#0d1117", foreground: "#e6edf3", cursor: "#58a6ff", selectionBackground: "#1c4f9c" }
      : { background: "#ffffff", foreground: "#1f2328", cursor: "#0969da", selectionBackground: "#b6d3f5" };
  }

  function doFit() {
    if (!fit || !term || el.clientWidth === 0 || el.clientHeight === 0) return;
    try {
      fit.fit();
      void invoke("term_resize", { id, cols: term.cols, rows: term.rows });
      term.scrollToBottom();
    } catch {
      /* ignore fit before layout settles */
    }
  }

  // Only the ACTIVE session holds a GPU renderer. Browsers cap concurrent
  // WebGL contexts per page (~8–16) and silently drop the least-recently-used
  // ones — with several terminal tabs, a hidden session's context got lost
  // and its canvas came back stale/blank on activation. Hidden sessions fall
  // back to xterm's DOM renderer (they're invisible anyway); the GPU renderer
  // attaches on activation. WebGL is preferred because it GPU-scales the
  // texture and stays aligned at fractional zoom; canvas is the fallback.
  async function attachRenderer() {
    if (renderer || !term) return;
    try {
      const { WebglAddon } = await import("@xterm/addon-webgl");
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        if (renderer === webgl) renderer = undefined; // re-attached on next activation
      });
      term.loadAddon(webgl);
      renderer = webgl;
    } catch {
      try {
        const { CanvasAddon } = await import("@xterm/addon-canvas");
        renderer = new CanvasAddon();
        term.loadAddon(renderer);
      } catch (e) {
        console.error("terminal renderer addon failed:", e);
      }
    }
  }

  function detachRenderer() {
    try {
      renderer?.dispose();
    } catch {
      /* already disposed (e.g. context loss) */
    }
    renderer = undefined;
  }

  onMount(async () => {
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);
    await import("@xterm/xterm/css/xterm.css");
    await import("../assets/fonts/juliamono.css");
    // Cell metrics depend on the bundled font being loaded before measuring.
    try {
      await document.fonts.load(`${zoomedFont()}px "JuliaMono"`);
      await document.fonts.ready;
    } catch {
      /* fonts API unavailable */
    }

    term = new Terminal({
      fontFamily: MONO,
      fontSize: zoomedFont(),
      lineHeight: 1.0,
      cursorBlink: true,
      theme: theme(),
      scrollback: 5000,
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    if (active) await attachRenderer();

    // Open the PTY only once the container has a real size, so the shell
    // starts at the correct width (no narrow initial layout).
    await waitForSize(el);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    doFit();

    await invoke("term_open", {
      id,
      cwd: workspace.root ?? null,
      cols: term.cols,
      rows: term.rows,
    });

    // "New agent terminal": run the preset command once the PTY is open.
    // The PTY buffers input, so the shell picks it up at its first prompt.
    const session = terminal.sessions.find((s) => s.id === id);
    if (session?.initialCommand) {
      void invoke("term_write", { id, data: session.initialCommand + "\r" });
      session.initialCommand = undefined;
    }

    // onData carries more than keystrokes: mouse-tracking, focus reports, and
    // the terminal's AUTO-REPLIES to TUI queries (cursor-position \x1b[..R,
    // device attributes, …). Claude Code polls those constantly, so anything
    // but a real keystroke must not count as "the user responded" — otherwise
    // lastInput stays fresh forever and the echo-guard swallows all output
    // (status pinned to idle). Whitelist real keys instead of blacklisting.
    const isUserKeystroke = (d: string): boolean => {
      if (!d.startsWith("\x1b")) return true; // printable chars, Enter, Ctrl-…
      if (d.startsWith("\x1b[200~")) return true; // bracketed paste
      if (/^\x1b(\[|O)[A-DHF]$/.test(d)) return true; // arrows / Home / End
      if (/^\x1b[\[\]OP]/.test(d)) return false; // CSI/OSC/SS3/DCS = reports
      return true; // Esc key itself / Alt-chords
    };
    // Reclaim throttle: a remote client (playdown-remote) may have resized
    // the PTY to phone width; typing here is the strongest "the desktop took
    // over" signal — re-assert our size at most every 2s (same-size resizes
    // are no-op ioctls, so this is free once reclaimed).
    let lastAssert = 0;
    term.onData((d: string) => {
      if (isUserKeystroke(d)) {
        terminal.noteInput(id);
        const now = Date.now();
        if (now - lastAssert > 2000) {
          lastAssert = now;
          void invoke("term_resize", { id, cols: term.cols, rows: term.rows });
        }
      }
      void invoke("term_write", { id, data: d });
    });
    // Programs (Claude Code included) set the terminal title — show it in the tab.
    term.onTitleChange((t: string) => terminal.setTitle(id, t));
    // Real bell only: xterm's parser separates an actual BEL from the 0x07
    // that terminates OSC sequences (title updates end with one — scanning
    // raw bytes falsely marked every title change as "blocked").
    term.onBell(() => terminal.noteBell(id));
    // Agents announce fan-out in plain text ("✳ Waiting for 1 dynamic
    // workflow to finish", "Running 3 agents…") and then go quiet — sniff the
    // decoded stream for it so the status stays "working" through the wait.
    // A rolling tail catches phrases split across PTY chunks.
    const waitDecoder = new TextDecoder("utf-8", { fatal: false });
    let textTail = "";
    const WAIT_RE = /(waiting for|running) [^\n]{0,60}?(workflows?|agents?|tasks?|subagents?)/i;
    const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)?/g;

    unlistenOut = await listen<string>(`term://${id}`, (e) => {
      // Decode base64 → bytes; xterm decodes UTF-8 statefully (handles
      // multi-byte glyphs split across PTY read chunks).
      const bin = atob(e.payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      term.write(bytes);
      terminal.noteOutput(id, bytes.length);

      const plain = waitDecoder.decode(bytes, { stream: true }).replace(ANSI_RE, "");
      textTail = (textTail + plain).slice(-240);
      if (WAIT_RE.test(textTail)) {
        terminal.noteWaiting(id);
        textTail = ""; // consume the match so it doesn't re-trigger forever
      }
    });
    unlistenExit = await listen(`term-exit://${id}`, () =>
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n"),
    );

    // Reclaim the PTY size on focus: a remote client (playdown-remote) may
    // have resized the PTY to phone width ("last client wins"); clicking back
    // into the terminal re-asserts the desktop's dimensions. No scrollToBottom
    // here — focusing to select/read history must not jump the viewport.
    // Same-size resizes are no-op ioctls, so this is free in the common case.
    const reclaim = () => {
      if (term && active) void invoke("term_resize", { id, cols: term.cols, rows: term.rows });
    };
    term.textarea?.addEventListener("focus", reclaim);
    // Also on app focus — returning to the laptop without re-focusing the
    // textarea (it never blurred) must still take the PTY back.
    window.addEventListener("focus", reclaim);
    onWinFocus = reclaim;

    ro = new ResizeObserver(() => scheduleFit());
    ro.observe(el);
    onWinResize = () => scheduleFit();
    window.addEventListener("resize", onWinResize);
    ready = true;
    if (active) {
      doFit();
      term.focus();
    }
  });

  // On activation: (re)attach the GPU renderer and force a full repaint —
  // fit() alone is a no-op when dimensions didn't change, which left a stale
  // canvas after visibility:hidden. On deactivation: release the renderer.
  $effect(() => {
    if (!ready) return;
    if (active) {
      requestAnimationFrame(() => {
        void (async () => {
          await attachRenderer();
          renderer?.clearTextureAtlas?.();
          doFit();
          if (term) term.refresh(0, Math.max(0, term.rows - 1));
          term?.focus();
        })();
      });
    } else {
      detachRenderer();
    }
  });

  // Grab keyboard focus when the app asks (⌘J focus-switch).
  $effect(() => {
    terminal.focusSeq;
    if (active && ready) term?.focus();
  });

  // Paste text on request (annotation prompt hand-off). xterm's paste()
  // uses bracketed paste when the app enabled it, so multi-line prompts
  // don't auto-execute at a shell prompt. Consuming the request globally
  // ensures ONLY the currently active session pastes it — inactive tabs
  // must never replay it when they later become active.
  $effect(() => {
    const req = terminal.pasteReq;
    if (req && active && ready && term) {
      terminal.consumePaste();
      term.paste(req.text);
      term.focus();
    }
  });

  // On app zoom, counter it via font size so the column count stays put
  // (no SIGWINCH → running TUIs don't reflow). Rebuild the glyph atlas.
  $effect(() => {
    const z = settings.zoom;
    if (ready && term) {
      term.options.fontSize = Math.max(8, Math.round(BASE_FONT / z));
      requestAnimationFrame(() => {
        renderer?.clearTextureAtlas?.();
        if (active) doFit();
      });
    }
  });

  // Live theme updates. theme() must be called unconditionally: when this
  // effect first ran `term` didn't exist yet, so a conditional read would
  // never register the reactive dependency and the effect would stay dead.
  $effect(() => {
    const th = theme();
    if (ready && term) {
      term.options.theme = th;
      // Canvas/WebGL renderers cache glyphs — rebuild so colors apply fully.
      requestAnimationFrame(() => renderer?.clearTextureAtlas?.());
    }
  });

  onDestroy(() => {
    unlistenOut?.();
    unlistenExit?.();
    ro?.disconnect();
    clearTimeout(fitTimer);
    if (onWinResize) window.removeEventListener("resize", onWinResize);
    if (onWinFocus) window.removeEventListener("focus", onWinFocus);
    void invoke("term_close", { id }).catch(() => {});
    term?.dispose();
  });
</script>

<div class="term-view" class:hidden={!active} bind:this={el}></div>
