<script lang="ts">
  import { groups } from "../stores/groups.svelte";
  import { settings } from "../stores/settings.svelte";
  import { workspace } from "../stores/workspace.svelte";
  import { terminal } from "../stores/terminal.svelte";

  // Agent status summary — visible even when the terminal panel is hidden.
  const agentCounts = $derived.by(() => {
    let working = 0, blocked = 0, done = 0;
    for (const s of terminal.sessions) {
      if (s.status === "working") working++;
      else if (s.status === "blocked") blocked++;
      else if (s.status === "done") done++;
    }
    return { working, blocked, done };
  });

  function openAgents() {
    if (!settings.terminalOpen) void settings.setTerminalOpen(true);
    const target =
      terminal.sessions.find((s) => s.status === "blocked") ??
      terminal.sessions.find((s) => s.status === "done");
    if (target) terminal.setActive(target.id);
  }

  let { onOpenSettings }: { onOpenSettings: () => void } = $props();

  const tab = $derived(groups.activeTab);
  const relPath = $derived(tab ? workspace.relativeOf(tab.path) : "");

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
      <span class="file" title={tab.path}>{relPath}</span>
      {#if groups.isDirtyPath(tab.path)}<span class="dot" title="Unsaved">●</span>{/if}
    {/if}
  </div>

  <div class="right">
    {#if tab}
      <span class="counts">{stats.words}w · {stats.chars}c · {stats.lines}L</span>
    {/if}
    <span class="counts">{Math.round(settings.zoom * 100)}%</span>
    {#if agentCounts.working + agentCounts.blocked + agentCounts.done > 0}
      <button class="status-btn agent-chip" title="Agent status — click to open" onclick={openAgents}>
        {#if agentCounts.working > 0}
          <span class="ac working">
            <svg class="tt-spin" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M8 1.5a6.5 6.5 0 1 1-4.6 1.9" />
            </svg>{agentCounts.working}
          </span>
        {/if}
        {#if agentCounts.blocked > 0}
          <span class="ac blocked">●{agentCounts.blocked}</span>
        {/if}
        {#if agentCounts.done > 0}
          <span class="ac done">●{agentCounts.done}</span>
        {/if}
      </button>
    {/if}
    <button class="status-btn" title="Toggle terminal (Ctrl+`)" onclick={() => settings.toggleTerminal()}>❯_</button>
    <button class="status-btn" title="Toggle theme" onclick={() => settings.toggleTheme()}>
      {settings.isDark ? "🌙" : "☀️"}
    </button>
    <button class="status-btn" title="Settings (⌘,)" onclick={onOpenSettings}>⚙</button>
  </div>
</div>
