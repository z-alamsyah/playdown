<script lang="ts">
  import type { EditorGroup, DropEdge } from "../types";
  import { groups } from "../stores/groups.svelte";
  import TabBar from "./TabBar.svelte";
  import EditorPane from "./EditorPane.svelte";
  import PreviewPane from "./PreviewPane.svelte";
  import ImagePane from "./ImagePane.svelte";
  import { fileKind } from "../fileKind";
  import { drag } from "../stores/drag.svelte";
  import { annotations } from "../stores/annotations.svelte";

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

  function toggleAnnotate() {
    groups.setActiveGroup(group.id);
    annotations.enabled = !annotations.enabled;
    // Annotating happens in the rendered view.
    if (annotations.enabled && group.viewMode === "edit") {
      groups.setViewMode(group.id, "preview");
    }
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
      {#if kind === "markdown"}
        <button
          class="ann-toggle"
          class:on={annotations.enabled}
          title="Annotate mode (⌘⇧A)"
          role="switch"
          aria-checked={annotations.enabled}
          onclick={toggleAnnotate}
        >
          <span class="ann-knob"></span>
          <span class="ann-toggle-label">Annotate</span>
        </button>
      {/if}
      <button
        class="ghost-btn"
        title="Toggle edit / preview (⌘E)"
        onclick={toggleView}
        aria-label="Toggle edit / preview"
      >
        {#if group.viewMode === "edit"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        {/if}
      </button>
      <button class="ghost-btn" title="Split right (⌘\)" onclick={splitRight} aria-label="Split right">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
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
