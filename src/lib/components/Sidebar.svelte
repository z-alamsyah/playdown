<script lang="ts">
  import type { Side } from "../types";
  import { workspace } from "../stores/workspace.svelte";
  import { settings } from "../stores/settings.svelte";
  import { ui } from "../stores/ui.svelte";
  import { promptNewEntry, promptRename, selectedDir, moveEntry, closeFolder } from "../fileActions";
  import FileTree from "./FileTree.svelte";
  import { drag } from "../stores/drag.svelte";

  let { side }: { side: Side } = $props();

  function onKey(e: KeyboardEvent) {
    // Enter on a selected node → rename (prevent the row button's activation).
    if (e.key === "Enter" && ui.selectedPath) {
      e.preventDefault();
      promptRename(ui.selectedPath);
    }
  }

  // Drop a dragged node on empty tree space → move it to the workspace root.
  // (Folder rows stop propagation, so this only fires outside a folder.)
  function onTreeUp() {
    if (drag.data?.kind === "node" && workspace.root) {
      void moveEntry(drag.data.path, workspace.root);
    }
  }

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = settings.sidebarWidth;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = side === "left" ? startW + dx : startW - dx;
      settings.sidebarWidth = clamp(next, 160, window.innerWidth * 0.5);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      void settings.setSidebarWidth(settings.sidebarWidth);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside class="sidebar panel-{side}" style="width: {settings.sidebarWidth}px" onkeydown={onKey}>
  <button
    class="panel-resize {side}"
    aria-label="Resize sidebar"
    onpointerdown={startResize}
  ></button>
  <div class="sidebar-header">
    <span class="folder-name" title={workspace.root ?? ""}>
      {workspace.rootName || "No folder"}
    </span>
    <div class="sidebar-actions">
      {#if workspace.root}
        <button class="icon-btn" title="New file" onclick={() => promptNewEntry(selectedDir()!, false)} aria-label="New file">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v5h5" />
            <path d="M12 11v6" /><path d="M9 14h6" />
          </svg>
        </button>
        <button class="icon-btn" title="New folder" onclick={() => promptNewEntry(selectedDir()!, true)} aria-label="New folder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            <path d="M12 10v6" /><path d="M9 13h6" />
          </svg>
        </button>
        <button class="icon-btn" title="Refresh" onclick={() => workspace.refresh()} aria-label="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        <button class="icon-btn" title="Close folder" onclick={() => closeFolder()} aria-label="Close folder">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            <path d="m9.5 10.5 5 5" /><path d="m14.5 10.5-5 5" />
          </svg>
        </button>
      {/if}
      <button class="icon-btn" title="Open folder (⌘O)" onclick={() => workspace.openFolder()} aria-label="Open folder">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      <button class="icon-btn" title="Hide sidebar (⌘B)" onclick={() => settings.setSidebarVisible(false)}>×</button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tree" onpointerup={onTreeUp}>
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
