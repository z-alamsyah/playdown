<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";

  let { id, active }: { id: string; active: boolean } = $props();

  let el: HTMLDivElement;
  // xterm is lazy-loaded, so keep these loosely typed.
  let term: any;
  let fit: any;
  let renderer: any;
  let unlistenOut: UnlistenFn | undefined;
  let unlistenExit: UnlistenFn | undefined;
  let ro: ResizeObserver | undefined;
  let ready = false;

  const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

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
    // Cell metrics depend on the monospace font being ready.
    try {
      await document.fonts?.ready;
    } catch {
      /* fonts API unavailable */
    }

    term = new Terminal({
      fontFamily: MONO,
      fontSize: 13,
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

    // Fit only once layout + fonts have settled.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    doFit();

    await invoke("term_open", {
      id,
      cwd: workspace.root ?? null,
      cols: term.cols,
      rows: term.rows,
    });

    term.onData((d: string) => void invoke("term_write", { id, data: d }));
    unlistenOut = await listen<string>(`term://${id}`, (e) => term.write(e.payload));
    unlistenExit = await listen(`term-exit://${id}`, () =>
      term.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n"),
    );

    ro = new ResizeObserver(() => active && doFit());
    ro.observe(el);
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

  // Refit when app zoom changes. Tauri's webview zoom doesn't change
  // devicePixelRatio, so rebuild the canvas glyph atlas too.
  $effect(() => {
    settings.zoom;
    if (ready && active) {
      requestAnimationFrame(() => {
        renderer?.clearTextureAtlas?.();
        doFit();
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
    void invoke("term_close", { id }).catch(() => {});
    term?.dispose();
  });
</script>

<div class="term-view" class:hidden={!active} bind:this={el}></div>
