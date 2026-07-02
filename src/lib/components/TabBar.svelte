<script lang="ts">
  import type { EditorGroup } from "../types";
  import { groups } from "../stores/groups.svelte";
  import { ui } from "../stores/ui.svelte";
  import { draggable } from "../actions/dnd";

  let { group }: { group: EditorGroup } = $props();

  function onTabContext(e: MouseEvent, i: number) {
    e.preventDefault();
    e.stopPropagation();
    ui.showMenu(e.clientX, e.clientY, [
      { label: "Close", action: () => groups.closeTab(group.id, i) },
      { label: "Close Others", action: () => groups.closeOthers(group.id, i) },
      { label: "Close All", separator: true, action: () => groups.closeAll(group.id) },
    ]);
  }

  // Disambiguating parent folder when two open tabs share a name.
  function hint(index: number): string {
    const tab = group.tabs[index];
    const dup = group.tabs.some((t, j) => j !== index && t.name === tab.name);
    if (!dup) return "";
    return tab.path.split(/[/\\]/).filter(Boolean).slice(-2, -1)[0] ?? "";
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
      title={tab.path}
      use:draggable={() => ({ kind: "tab", groupId: group.id, index: i, label: tab.name })}
      onclick={() => groups.setActiveTab(group.id, i)}
      onkeydown={(e) => e.key === "Enter" && groups.setActiveTab(group.id, i)}
      oncontextmenu={(e) => onTabContext(e, i)}
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
