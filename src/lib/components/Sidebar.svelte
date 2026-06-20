<script lang="ts">
  import { workspace } from "../stores/workspace.svelte";
  import FileTree from "./FileTree.svelte";
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <span class="folder-name" title={workspace.root ?? ""}>
      {workspace.rootName || "No folder"}
    </span>
    <div class="sidebar-actions">
      {#if workspace.root}
        <button class="icon-btn" title="Refresh" onclick={() => workspace.refresh()}>⟳</button>
      {/if}
      <button class="icon-btn" title="Open folder (⌘O)" onclick={() => workspace.openFolder()}>
        📂
      </button>
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
