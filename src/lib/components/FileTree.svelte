<script lang="ts">
  import type { FileNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import { ui } from "../stores/ui.svelte";
  import { nodeMenuItems, moveEntry, openInBrowser } from "../fileActions";
  import { iconFor } from "../fileIcons";
  import { isHtml } from "../fileKind";
  import { draggable } from "../actions/dnd";
  import { drag } from "../stores/drag.svelte";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});
  let dragOver = $state<string | null>(null);

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }

  function onContext(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    ui.select(node.path, node.is_dir);
    ui.showMenu(e.clientX, e.clientY, nodeMenuItems(node));
  }

  // Pointer-based move: highlight a folder while a node is dragged over it;
  // dropping moves the dragged file/folder into it.
  function onDirEnter(node: FileNode) {
    if (drag.data?.kind === "node" && drag.data.path !== node.path) dragOver = node.path;
  }
  function onDirLeave(node: FileNode) {
    if (dragOver === node.path) dragOver = null;
  }
  function onDirUp(e: PointerEvent, node: FileNode) {
    if (drag.data?.kind !== "node") return;
    e.stopPropagation(); // don't also fall through to the root-drop container
    const src = drag.data.path;
    dragOver = null;
    if (src !== node.path) void moveEntry(src, node.path);
  }
</script>

{#snippet ficon(name: string, isDir: boolean)}
  {@const ic = iconFor(name, isDir)}
  <svg
    class="fticon"
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill={ic.fill ? ic.color : "none"}
    stroke={ic.fill ? "none" : ic.color}
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round">{@html ic.paths}</svg
  >
{/snippet}

<ul class="filetree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button
          class="row dir"
          class:selected={ui.selectedPath === node.path}
          class:drop-target={dragOver === node.path}
          data-path={node.path}
          use:draggable={() => ({ kind: "node", path: node.path, label: node.name })}
          onpointerenter={() => onDirEnter(node)}
          onpointerleave={() => onDirLeave(node)}
          onpointerup={(e) => onDirUp(e, node)}
          onclick={(e) => {
            ui.select(node.path, true);
            (e.currentTarget as HTMLElement).focus();
            toggle(node.path);
          }}
          oncontextmenu={(e) => onContext(e, node)}
        >
          <span class="caret">{expanded[node.path] ? "▾" : "▸"}</span>
          {@render ficon(node.name, true)}
          <span class="label">{node.name}</span>
        </button>
        {#if expanded[node.path] && node.children}
          <Self nodes={node.children} depth={depth + 1} />
        {/if}
      {:else}
        <button
          class="row file"
          class:active={groups.activeTab?.path === node.path}
          class:selected={ui.selectedPath === node.path}
          use:draggable={() => ({ kind: "node", path: node.path, label: node.name })}
          onclick={(e) => {
            ui.select(node.path, false);
            (e.currentTarget as HTMLElement).focus();
            groups.openFile(node.path, node.name);
          }}
          ondblclick={() => isHtml(node.path) && openInBrowser(node.path)}
          oncontextmenu={(e) => onContext(e, node)}
        >
          <span class="caret-spacer"></span>
          {@render ficon(node.name, false)}
          <span class="label">{node.name}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>
