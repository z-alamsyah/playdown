<script lang="ts">
  import type { EditorGroup } from "../types";
  import { groups } from "../stores/groups.svelte";

  let { group }: { group: EditorGroup } = $props();

  // Disambiguating parent folder when two open tabs share a name.
  function hint(index: number): string {
    const tab = group.tabs[index];
    const dup = group.tabs.some((t, j) => j !== index && t.name === tab.name);
    if (!dup) return "";
    return tab.path.split(/[/\\]/).filter(Boolean).slice(-2, -1)[0] ?? "";
  }

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
      {#if hint(i)}<span class="tab-hint">{hint(i)}</span>{/if}
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
