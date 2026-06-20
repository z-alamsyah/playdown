<script lang="ts">
  import type { Side } from "../types";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import FileTree from "./FileTree.svelte";

  let { side }: { side: Side } = $props();
</script>

<aside class="sidebar panel-{side}">
  <div class="sidebar-header">
    <span class="folder-name" title={workspace.root ?? ""}>
      {workspace.rootName || "No folder"}
    </span>
    <div class="sidebar-actions">
      {#if workspace.root}
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
