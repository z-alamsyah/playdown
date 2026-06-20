<script lang="ts">
  import { tabs } from "../stores/tabs.svelte";
  import { settings } from "../stores/settings.svelte";

  const stats = $derived.by(() => {
    const c = tabs.active?.content ?? "";
    const trimmed = c.trim();
    return {
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      chars: c.length,
      lines: c ? c.split("\n").length : 0,
    };
  });
</script>

<div class="statusbar">
  <div class="left">
    {#if tabs.active}
      <span class="file">{tabs.active.name}</span>
      {#if tabs.isDirty(tabs.active)}<span class="dot" title="Unsaved">●</span>{/if}
    {:else}
      <span class="muted">No file open</span>
    {/if}
  </div>

  <div class="right">
    {#if tabs.active}
      <span class="counts">{stats.words}w · {stats.chars}c · {stats.lines}L</span>
    {/if}
    <button class="status-btn" onclick={() => settings.toggleView()}>
      {settings.viewMode === "edit" ? "👁 Preview" : "✏️ Edit"}
      <kbd>⌘E</kbd>
    </button>
    <button class="status-btn" title="Toggle theme" onclick={() => settings.toggleTheme()}>
      {settings.theme === "dark" ? "🌙" : "☀️"}
    </button>
  </div>
</div>
