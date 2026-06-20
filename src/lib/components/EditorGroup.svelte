<script lang="ts">
  import type { EditorGroup, DropEdge } from "../types";
  import { groups } from "../stores/groups.svelte";
  import TabBar from "./TabBar.svelte";
  import EditorPane from "./EditorPane.svelte";
  import PreviewPane from "./PreviewPane.svelte";

  let { group }: { group: EditorGroup } = $props();

  let paneEl: HTMLDivElement;
  let dropEdge = $state<DropEdge | null>(null);

  const activeTab = $derived(
    group.activeIndex >= 0 ? group.tabs[group.activeIndex] : null,
  );

  function computeEdge(e: DragEvent): DropEdge {
    const r = paneEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const m = 0.22;
    if (x < m) return "left";
    if (x > 1 - m) return "right";
    if (y < m) return "top";
    if (y > 1 - m) return "bottom";
    return "center";
  }

  function isTabDrag(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes(
      "application/x-playdown-tab",
    );
  }

  function onDragOver(e: DragEvent) {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    dropEdge = computeEdge(e);
  }

  function onDragLeave(e: DragEvent) {
    // Ignore leaves that bubble from children still inside the pane.
    if (paneEl.contains(e.relatedTarget as Node)) return;
    dropEdge = null;
  }

  function onDrop(e: DragEvent) {
    if (!isTabDrag(e)) return;
    e.preventDefault();
    const data = e.dataTransfer?.getData("application/x-playdown-tab");
    const edge = computeEdge(e);
    dropEdge = null;
    if (!data) return;
    try {
      const { groupId, index } = JSON.parse(data);
      groups.splitWithTab(groupId, index, group.id, edge);
    } catch {
      /* malformed payload */
    }
  }

  function toggleView() {
    groups.setActiveGroup(group.id);
    groups.setViewMode(group.id, group.viewMode === "edit" ? "preview" : "edit");
  }

  function splitRight() {
    groups.setActiveGroup(group.id);
    groups.splitActive("right");
  }
</script>

<div
  class="editor-group"
  class:active={group.id === groups.activeGroupId}
  onpointerdowncapture={() => groups.setActiveGroup(group.id)}
>
  <div class="group-header">
    <TabBar {group} />
    <div class="group-actions">
      <button
        class="ghost-btn"
        title="Toggle edit / preview (⌘E)"
        onclick={toggleView}
      >
        {group.viewMode === "edit" ? "👁" : "✏️"}
      </button>
      <button class="ghost-btn" title="Split right (⌘\)" onclick={splitRight}>
        ⊟
      </button>
    </div>
  </div>

  <div
    class="group-pane"
    bind:this={paneEl}
    role="group"
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
  >
    {#if activeTab}
      {#key activeTab.path + "::" + group.viewMode}
        {#if group.viewMode === "edit"}
          <EditorPane path={activeTab.path} />
        {:else}
          <PreviewPane path={activeTab.path} />
        {/if}
      {/key}
    {:else}
      <div class="group-empty">
        <p>No file open</p>
        <span><kbd>⌘P</kbd> search files</span>
      </div>
    {/if}

    {#if dropEdge}
      <div class="drop-overlay {dropEdge}"></div>
    {/if}
  </div>
</div>
