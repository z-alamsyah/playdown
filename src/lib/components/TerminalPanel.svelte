<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { terminal } from "../stores/terminal.svelte";
  import { settings } from "../stores/settings.svelte";
  import TerminalView from "./TerminalView.svelte";

  let { hidden = false }: { hidden?: boolean } = $props();

  onMount(async () => {
    try {
      terminal.shellName = await invoke<string>("default_shell");
    } catch {
      /* keep default label */
    }
    terminal.ensureOne();
  });

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const bottom = settings.terminalSide === "bottom";
    const start = bottom ? e.clientY : e.clientX;
    const startSize = bottom ? settings.terminalHeight : settings.terminalWidth;
    const move = (ev: PointerEvent) => {
      const cur = bottom ? ev.clientY : ev.clientX;
      const next = startSize + (start - cur);
      if (bottom) settings.terminalHeight = clamp(next, 120, window.innerHeight * 0.85);
      else settings.terminalWidth = clamp(next, 240, window.innerWidth * 0.8);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (bottom) void settings.setTerminalHeight(settings.terminalHeight);
      else void settings.setTerminalWidth(settings.terminalWidth);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<div
  class="terminal-panel {settings.terminalSide}"
  class:hidden
  style={settings.terminalSide === "bottom"
    ? `height: ${settings.terminalHeight}px`
    : `width: ${settings.terminalWidth}px`}
>
  <button
    class="terminal-resize {settings.terminalSide}"
    aria-label="Resize terminal"
    onpointerdown={startResize}
  ></button>

  <div class="terminal-header">
    <span class="th-title">TERMINAL</span>
    <div class="terminal-tabs-strip">
      {#each terminal.sessions as s, i (s.id)}
        <button
          class="term-tab"
          class:on={s.id === terminal.activeId}
          title="{i + 1}: {s.label}"
          onclick={() => terminal.setActive(s.id)}
        >
          <span class="tt-name">{i + 1}: {s.label}</span>
          <span
            class="tt-kill"
            role="button"
            tabindex="0"
            title="Kill"
            onclick={(e) => {
              e.stopPropagation();
              terminal.close(s.id);
            }}
            onkeydown={(e) => e.key === "Enter" && terminal.close(s.id)}
          >×</span>
        </button>
      {/each}
    </div>
    <div class="th-actions">
      <button class="icon-btn" title="New terminal" onclick={() => terminal.create()}>＋</button>
      <button
        class="icon-btn"
        title={settings.terminalSide === "bottom" ? "Dock right" : "Dock bottom"}
        onclick={() => settings.toggleTerminalSide()}
      >{settings.terminalSide === "bottom" ? "⇥" : "⤓"}</button>
      <button class="icon-btn" title="Close (Ctrl+`)" onclick={() => settings.setTerminalOpen(false)}>×</button>
    </div>
  </div>

  <div class="terminal-stage">
    {#each terminal.sessions as s (s.id)}
      <TerminalView id={s.id} active={s.id === terminal.activeId} />
    {/each}
    {#if terminal.sessions.length === 0}
      <div class="muted term-empty">No terminal sessions</div>
    {/if}
  </div>
</div>
