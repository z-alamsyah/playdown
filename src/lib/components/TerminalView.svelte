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
    if (!fit || !term) return;
    try {
      fit.fit();
      void invoke("term_resize", { id, cols: term.cols, rows: term.rows });
    } catch {
      /* ignore fit before layout */
    }
  }

  onMount(async () => {
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);
    await import("@xterm/xterm/css/xterm.css");

    term = new Terminal({
      fontFamily: MONO,
      fontSize: 13,
      cursorBlink: true,
      theme: theme(),
      scrollback: 5000,
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

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
