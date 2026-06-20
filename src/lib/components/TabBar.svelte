<script lang="ts">
  import type { EditorGroup } from "../types";
  import { groups } from "../stores/groups.svelte";

  let { group }: { group: EditorGroup } = $props();

  function onDragStart(e: DragEvent, index: number) {
    e.dataTransfer?.setData(
      "application/x-playdown-tab",
      JSON.stringify({ groupId: group.id, index }),
    );
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }
</script>

<div class="tabbar">
  {#each group.tabs as tab, i (tab.path)}
    <div
      class="tab"
      class:active={i === group.activeIndex}
      class:current={i === group.activeIndex && group.id === groups.activeGroupId}
      role="button"
      tabindex="0"
      draggable="true"
      title={tab.path}
      ondragstart={(e) => onDragStart(e, i)}
      onclick={() => groups.setActiveTab(group.id, i)}
      onkeydown={(e) => e.key === "Enter" && groups.setActiveTab(group.id, i)}
    >
      <span class="tab-name">{tab.name}</span>
      {#if groups.isDirtyPath(tab.path)}
        <span class="dirty" title="Unsaved changes">●</span>
      {/if}
      <button
        class="close"
        title="Close (⌘W)"
        onclick={(e) => {
          e.stopPropagation();
          groups.closeTab(group.id, i);
        }}
      >
        ×
      </button>
    </div>
  {/each}
</div>
