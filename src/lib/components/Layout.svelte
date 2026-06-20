<script lang="ts">
  import type { LayoutNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import EditorGroup from "./EditorGroup.svelte";
  import Self from "./Layout.svelte";

  let { node }: { node: LayoutNode } = $props();

  let containerEl = $state<HTMLDivElement>();

  function nodeKey(n: LayoutNode): string {
    return n.type === "leaf" ? `leaf:${n.groupId}` : `split:${n.id}`;
  }

  function startResize(e: PointerEvent, i: number) {
    if (node.type !== "split" || !containerEl) return;
    e.preventDefault();
    const horizontal = node.direction === "row";
    const rect = containerEl.getBoundingClientRect();
    const total = horizontal ? rect.width : rect.height;
    const a = node.children[i];
    const b = node.children[i + 1];
    const sum = a.size + b.size;
    const startPos = horizontal ? e.clientX : e.clientY;
    const startA = a.size;

    const move = (ev: PointerEvent) => {
      const cur = horizontal ? ev.clientX : ev.clientY;
      const delta = ((cur - startPos) / total) * sum;
      let na = startA + delta;
      const min = sum * 0.12;
      na = Math.max(min, Math.min(sum - min, na));
      a.size = na;
      b.size = sum - na;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
</script>

{#if node.type === "leaf"}
  {@const g = groups.group(node.groupId)}
  {#if g}
    <EditorGroup group={g} />
  {/if}
{:else}
  <div class="layout-split {node.direction}" bind:this={containerEl}>
    {#each node.children as child, i (nodeKey(child))}
      <div class="layout-cell" style="flex-grow: {child.size};">
        <Self node={child} />
      </div>
      {#if i < node.children.length - 1}
        <button
          class="divider {node.direction}"
          aria-label="Resize panes"
          onpointerdown={(e) => startResize(e, i)}
        ></button>
      {/if}
    {/each}
  </div>
{/if}
