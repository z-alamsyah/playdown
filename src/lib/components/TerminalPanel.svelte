<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { terminal } from "../stores/terminal.svelte";
  import { settings } from "../stores/settings.svelte";
  import TerminalView from "./TerminalView.svelte";

  onMount(async () => {
    try {
      terminal.shellName = await invoke<string>("default_shell");
    } catch {
      /* keep default label */
    }
    terminal.ensureOne();
  });

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = settings.terminalHeight;
    const move = (ev: PointerEvent) => {
      const next = startH + (startY - ev.clientY);
      const max = window.innerHeight * 0.8;
      settings.terminalHeight = Math.max(120, Math.min(max, next));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      void settings.setTerminalHeight(settings.terminalHeight);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<div class="terminal-panel" style="height: {settings.terminalHeight}px">
  <button class="terminal-resize" aria-label="Resize terminal" onpointerdown={startResize}></button>

  <div class="terminal-main">
    <div class="terminal-stage">
      {#each terminal.sessions as s (s.id)}
        <TerminalView id={s.id} active={s.id === terminal.activeId} />
      {/each}
      {#if terminal.sessions.length === 0}
        <div class="muted term-empty">No terminal sessions</div>
      {/if}
    </div>

    <div class="terminal-tabs">
      <div class="terminal-tabs-head">
        <span>TERMINAL</span>
        <div class="tt-actions">
          <button class="icon-btn" title="New terminal" onclick={() => terminal.create()}>＋</button>
          <button class="icon-btn" title="Close panel (Ctrl+`)" onclick={() => settings.setTerminalOpen(false)}>×</button>
        </div>
      </div>
      <div class="terminal-tabs-list">
        {#each terminal.sessions as s, i (s.id)}
          <div
            class="term-tab"
            class:on={s.id === terminal.activeId}
            role="button"
            tabindex="0"
            onclick={() => terminal.setActive(s.id)}
            onkeydown={(e) => e.key === "Enter" && terminal.setActive(s.id)}
          >
            <span class="tt-icon">❯</span>
            <span class="tt-name">{i + 1}: {s.label}</span>
            <button
              class="tt-kill"
              title="Kill terminal"
              onclick={(e) => {
                e.stopPropagation();
                terminal.close(s.id);
              }}
            >
              🗑
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
