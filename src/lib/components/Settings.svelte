<script lang="ts">
  import { settings, TITLEBAR_COLORS } from "../stores/settings.svelte";
  import {
    keymap,
    ACTIONS,
    prettyCombo,
    eventToCombo,
    type Action,
  } from "../stores/keymap.svelte";
  import { zoomIn, zoomOut, zoomReset } from "../tauri/zoom";
  import type { TitlebarColor } from "../types";

  const titlebarColors = Object.keys(TITLEBAR_COLORS) as TitlebarColor[];

  let { onClose }: { onClose: () => void } = $props();

  let capturing = $state<Action | null>(null);

  function onCaptureKey(e: KeyboardEvent) {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturing = null;
      return;
    }
    const combo = eventToCombo(e);
    if (!combo) return; // lone modifier — keep waiting
    keymap.set(capturing, combo);
    capturing = null;
  }
</script>

<svelte:window onkeydown={capturing ? onCaptureKey : undefined} />

<div class="modal-backdrop" role="presentation" onclick={onClose}></div>
<div class="modal settings-modal" role="dialog" aria-modal="true">
  <div class="modal-header">
    <h2>Settings</h2>
    <button class="icon-btn" title="Close" onclick={onClose}>×</button>
  </div>

  <div class="modal-body">
    <section>
      <h3>Appearance</h3>
      <div class="setting-row">
        <span>Theme</span>
        <div class="seg">
          <button class:on={settings.theme === "dark"} onclick={() => settings.setTheme("dark")}>🌙 Dark</button>
          <button class:on={settings.theme === "light"} onclick={() => settings.setTheme("light")}>☀️ Light</button>
        </div>
      </div>
      <div class="setting-row">
        <span>Title bar color</span>
        <div class="swatches">
          {#each titlebarColors as c}
            <button
              class="swatch"
              class:on={settings.titlebarColor === c}
              style="--sw: {TITLEBAR_COLORS[c][0]}"
              title={c}
              aria-label={c}
              onclick={() => settings.setTitlebarColor(c)}
            ></button>
          {/each}
        </div>
      </div>
      <div class="setting-row">
        <span>Sidebar position</span>
        <div class="seg">
          <button class:on={settings.sidebarSide === "left"} onclick={() => settings.setSidebarSide("left")}>Left</button>
          <button class:on={settings.sidebarSide === "right"} onclick={() => settings.setSidebarSide("right")}>Right</button>
        </div>
      </div>
      <div class="setting-row">
        <span>Zoom</span>
        <div class="seg">
          <button onclick={zoomOut}>−</button>
          <button onclick={zoomReset}>{Math.round(settings.zoom * 100)}%</button>
          <button onclick={zoomIn}>+</button>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h3>Shortcuts</h3>
        <button class="link-btn" onclick={() => keymap.resetAll()}>reset all</button>
      </div>
      <div class="shortcut-list">
        {#each ACTIONS as a (a.id)}
          <div class="shortcut-row">
            <span class="sc-label">{a.label}</span>
            <button
              class="sc-key"
              class:capturing={capturing === a.id}
              onclick={() => (capturing = a.id)}
            >
              {capturing === a.id ? "Press keys…" : prettyCombo(keymap.combo(a.id))}
            </button>
          </div>
        {/each}
      </div>
      <p class="muted small">Click a shortcut, then press the new combo. Esc cancels.</p>
    </section>
  </div>
</div>
