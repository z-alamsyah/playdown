<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { terminal } from "../stores/terminal.svelte";
  import { settings } from "../stores/settings.svelte";
  import { ui } from "../stores/ui.svelte";
  import TerminalView from "./TerminalView.svelte";

  function promptRename(id: string, current: string) {
    ui.showPrompt({
      title: "Rename terminal",
      value: current,
      placeholder: "e.g. verifier",
      confirmLabel: "Rename",
      onSubmit: (name) => {
        ui.closePrompt();
        terminal.rename(id, name);
      },
    });
  }

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

  // ---- split view ----------------------------------------------------------
  // Every TerminalView stays mounted in the one stage (moving it to another
  // parent would remount it and kill its PTY), so a split is pure placement:
  // the two visible sessions get inline left/width (or top/height) and the
  // rest stay hidden. Split along the panel's long side - columns when docked
  // at the bottom, rows when docked on the right.
  let stage: HTMLDivElement;
  const cols = $derived(settings.terminalSide === "bottom");

  function paneLayout(id: string): string {
    const ids = terminal.splitIds;
    if (!ids) return "";
    const i = ids.indexOf(id);
    if (i < 0) return "";
    const r = terminal.splitRatio * 100;
    if (cols) {
      return i === 0
        ? `right:auto;width:calc(${r}% - 2px)`
        : `left:calc(${r}% + 2px)`;
    }
    return i === 0
      ? `bottom:auto;height:calc(${r}% - 2px)`
      : `top:calc(${r}% + 2px)`;
  }

  function startSplitDrag(e: PointerEvent) {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const f = cols
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top) / rect.height;
      terminal.splitRatio = clamp(f, 0.2, 0.8);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

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

{#snippet tab(s: import("../stores/terminal.svelte").TermSession, i: number)}
  <button
    class="term-tab"
    class:on={s.id === terminal.activeId}
    class:shown={s.id !== terminal.activeId && terminal.isVisible(s.id)}
    title="{i + 1}: {terminal.displayName(s)} — {s.status} (double-click to rename)"
    onclick={() => terminal.setActive(s.id)}
    ondblclick={() => promptRename(s.id, terminal.displayName(s))}
  >
    {#if s.status === "working"}
      <svg class="tt-spin" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <path d="M8 1.5a6.5 6.5 0 1 1-4.6 1.9" />
      </svg>
    {:else}
      <span class="tt-dot {s.status}"></span>
    {/if}
    <span class="tt-name">{i + 1}: {terminal.displayName(s)}</span>
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
{/snippet}

{#snippet actions()}
  <button
    class="icon-btn"
    class:on={terminal.splitIds !== null}
    title={terminal.splitIds ? "Unsplit terminal (⌘\\ in terminal)" : "Split terminal (⌘\\ in terminal)"}
    onclick={() => terminal.toggleSplit()}
    aria-label="Split terminal"
  >
    {#if cols}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    {/if}
  </button>
  <button class="icon-btn" title="New terminal (⌘T)" onclick={() => terminal.create()} aria-label="New terminal">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  </button>
  <button
    class="icon-btn"
    title={settings.terminalSide === "bottom" ? "Dock right" : "Dock bottom"}
    onclick={() => settings.toggleTerminalSide()}
    aria-label="Toggle dock side"
  >
    {#if settings.terminalSide === "bottom"}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    {:else}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
    {/if}
  </button>
  <button class="icon-btn" title="Close (Ctrl+`)" onclick={() => settings.setTerminalOpen(false)}>×</button>
{/snippet}

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

  <div class="terminal-body {settings.terminalSide}">
    {#if settings.terminalSide === "right"}
      <div class="terminal-header">
        <span class="th-title">TERMINAL</span>
        <div class="terminal-tabs-strip">
          {#each terminal.sessions as s, i (s.id)}{@render tab(s, i)}{/each}
        </div>
        <div class="th-actions">{@render actions()}</div>
      </div>
    {/if}

    <!-- Persistent stage — kept mounted across dock toggles so PTYs survive. -->
    <div class="terminal-stage" bind:this={stage}>
      {#each terminal.sessions as s (s.id)}
        <TerminalView
          id={s.id}
          visible={terminal.isVisible(s.id)}
          focused={s.id === terminal.activeId}
          layout={paneLayout(s.id)}
        />
      {/each}
      {#if terminal.splitIds}
        <button
          class="term-split-divider"
          class:cols
          style={cols
            ? `left:calc(${terminal.splitRatio * 100}% - 2px)`
            : `top:calc(${terminal.splitRatio * 100}% - 2px)`}
          aria-label="Resize split"
          onpointerdown={startSplitDrag}
          ondblclick={() => (terminal.splitRatio = 0.5)}
        ></button>
      {/if}
      {#if terminal.sessions.length === 0}
        <div class="muted term-empty">No terminal sessions</div>
      {/if}
    </div>

    {#if settings.terminalSide === "bottom"}
      <div class="terminal-tabs">
        <div class="terminal-tabs-head">
          <span class="th-title">TERMINAL</span>
          <div class="th-actions">{@render actions()}</div>
        </div>
        <div class="terminal-tabs-list">
          {#each terminal.sessions as s, i (s.id)}{@render tab(s, i)}{/each}
        </div>
      </div>
    {/if}
  </div>
</div>
