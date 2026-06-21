<script lang="ts">
  import type { Side } from "../types";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import { ui } from "../stores/ui.svelte";
  import { copyText } from "../tauri/clipboard";
  import { promptNewEntry } from "../fileActions";
  import FileTree from "./FileTree.svelte";

  let { side }: { side: Side } = $props();

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && ui.selectedPath) {
      e.preventDefault();
      void copyText(ui.selectedPath);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside class="sidebar panel-{side}" onkeydown={onKey}>
  <div class="sidebar-header">
    <span class="folder-name" title={workspace.root ?? ""}>
      {workspace.rootName || "No folder"}
    </span>
    <div class="sidebar-actions">
      {#if workspace.root}
        <button class="icon-btn" title="New file" onclick={() => promptNewEntry(workspace.root!, false)} aria-label="New file">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v5h5" />
            <path d="M12 11v6" /><path d="M9 14h6" />
          </svg>
        </button>
        <button class="icon-btn" title="New folder" onclick={() => promptNewEntry(workspace.root!, true)} aria-label="New folder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            <path d="M12 10v6" /><path d="M9 13h6" />
          </svg>
        </button>
        <button class="icon-btn" title="Refresh" onclick={() => workspace.refresh()}>⟳</button>
      {/if}
      <button class="icon-btn" title="Open folder (⌘O)" onclick={() => workspace.openFolder()}>📂</button>
      <button class="icon-btn" title="Hide sidebar (⌘B)" onclick={() => settings.setSidebarVisible(false)}>×</button>
    </div>
  </div>

  <div class="tree">
    {#if workspace.loading}
      <div class="muted">Loading…</div>
    {:else if !workspace.root}
      <div class="muted">Open a folder, or drag one onto the window.</div>
    {:else if workspace.tree.length === 0}
      <div class="muted">No markdown files found.</div>
    {:else}
      <FileTree nodes={workspace.tree} depth={0} />
    {/if}
  </div>
</aside>
