<script lang="ts">
  import type { EditorGroup, DropEdge } from "../types";
  import { groups } from "../stores/groups.svelte";
  import TabBar from "./TabBar.svelte";
  import EditorPane from "./EditorPane.svelte";
  import PreviewPane from "./PreviewPane.svelte";
  import ImagePane from "./ImagePane.svelte";
  import { fileKind } from "../fileKind";
  import { drag } from "../stores/drag.svelte";

  let { group }: { group: EditorGroup } = $props();

  let paneEl: HTMLDivElement;
  let dropEdge = $state<DropEdge | null>(null);

  const activeTab = $derived(
    group.activeIndex >= 0 ? group.tabs[group.activeIndex] : null,
  );
  const kind = $derived(activeTab ? fileKind(activeTab.path) : "text");

  function computeEdge(e: PointerEvent): DropEdge {
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

  function onPaneMove(e: PointerEvent) {
    if (drag.data?.kind !== "tab") return;
    dropEdge = computeEdge(e);
  }

  function onPaneLeave() {
    dropEdge = null;
  }

  function onPaneUp(e: PointerEvent) {
    if (drag.data?.kind !== "tab") return;
    const { groupId, index } = drag.data;
    const edge = computeEdge(e);
    dropEdge = null;
    groups.splitWithTab(groupId, index, group.id, edge);
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
    onpointermove={onPaneMove}
    onpointerleave={onPaneLeave}
    onpointerup={onPaneUp}
  >
    {#if activeTab}
      {#key activeTab.path + "::" + group.viewMode}
        {#if kind === "image"}
          <ImagePane path={activeTab.path} />
        {:else if group.viewMode === "edit"}
          <EditorPane path={activeTab.path} groupId={group.id} {kind} />
        {:else}
          <PreviewPane path={activeTab.path} groupId={group.id} {kind} />
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
