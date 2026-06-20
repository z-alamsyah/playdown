<script lang="ts">
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";

  const tab = $derived(groups.activeTab);

  const stats = $derived.by(() => {
    const c = tab ? groups.docContent(tab.path) : "";
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
    {#if tab}
      <span class="file">{tab.name}</span>
      {#if groups.isDirtyPath(tab.path)}<span class="dot" title="Unsaved">●</span>{/if}
    {:else}
      <span class="muted">No file open</span>
    {/if}
  </div>

  <div class="right">
    {#if tab}
      <span class="counts">{stats.words}w · {stats.chars}c · {stats.lines}L</span>
    {/if}
    <button class="status-btn" title="Toggle theme" onclick={() => settings.toggleTheme()}>
      {settings.theme === "dark" ? "🌙 Dark" : "☀️ Light"}
    </button>
  </div>
</div>
