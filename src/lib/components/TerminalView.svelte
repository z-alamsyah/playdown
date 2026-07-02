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
  let fitTimer: ReturnType<typeof setTimeout> | undefined;
  let ready = false;

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
    return settings.theme === "dark"
      ? { background: "#16171a", foreground: "#d4d6db", cursor: "#4c8bf5", selectionBackground: "#33405a" }
      : { background: "#ffffff", foreground: "#24292f", cursor: "#0969da", selectionBackground: "#bcd6f5" };
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
    // WebGL renderer GPU-scales the whole texture — unlike the canvas/DOM
    // renderers it doesn't round each cell to integer pixels, so it stays
    // aligned at fractional zoom (webview zoom → fractional devicePixelRatio).
    // Fall back to canvas, then the built-in DOM renderer.
    try {
      const { WebglAddon } = await import("@xterm/addon-webgl");
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        if (renderer === webgl) renderer = undefined;
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

    term.onData((d: string) => void invoke("term_write", { id, data: d }));
    unlistenOut = await listen<string>(`term://${id}`, (e) => {
      // Decode base64 → bytes; xterm decodes UTF-8 statefully (handles
      // multi-byte glyphs split across PTY read chunks).
      const bin = atob(e.payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      term.write(bytes);
    });
    unlistenExit = await listen(`term-exit://${id}`, () =>
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n"),
    );

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

  // Refit + focus when this session becomes the active one.
  $effect(() => {
    if (active && ready) {
      requestAnimationFrame(() => {
        doFit();
        term?.focus();
      });
    }
  });

  // Grab keyboard focus when the app asks (⌘J focus-switch).
  $effect(() => {
    terminal.focusSeq;
    if (active && ready) term?.focus();
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

  // Live theme updates.
  $effect(() => {
    if (term) term.options.theme = theme();
  });

  onDestroy(() => {
    unlistenOut?.();
    unlistenExit?.();
    ro?.disconnect();
    clearTimeout(fitTimer);
    if (onWinResize) window.removeEventListener("resize", onWinResize);
    void invoke("term_close", { id }).catch(() => {});
    term?.dispose();
  });
</script>

<div class="term-view" class:hidden={!active} bind:this={el}></div>
