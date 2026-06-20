<script lang="ts">
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";

  let { onOpenSettings }: { onOpenSettings: () => void } = $props();

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
    <button class="status-btn" title="Toggle sidebar (⌘B)" onclick={() => settings.toggleSidebar()}>▤</button>
    <button class="status-btn" title="Toggle outline (⌘⇧O)" onclick={() => settings.toggleOutline()}>☰</button>
    {#if tab}
      <span class="file">{tab.name}</span>
      {#if groups.isDirtyPath(tab.path)}<span class="dot" title="Unsaved">●</span>{/if}
    {/if}
  </div>

  <div class="right">
    {#if tab}
      <span class="counts">{stats.words}w · {stats.chars}c · {stats.lines}L</span>
    {/if}
    <span class="counts">{Math.round(settings.zoom * 100)}%</span>
    <button class="status-btn" title="Toggle theme" onclick={() => settings.toggleTheme()}>
      {settings.theme === "dark" ? "🌙" : "☀️"}
    </button>
    <button class="status-btn" title="Settings (⌘,)" onclick={onOpenSettings}>⚙</button>
  </div>
</div>
