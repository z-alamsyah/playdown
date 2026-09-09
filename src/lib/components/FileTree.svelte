<script lang="ts">
  import type { FileNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import { ui } from "../stores/ui.svelte";
  import { nodeMenuItems, openInBrowser, parentDir } from "../fileActions";
  import { iconFor } from "../fileIcons";
  import { isHtml } from "../fileKind";
  import { draggable } from "../actions/dnd";
  import { drag } from "../stores/drag.svelte";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }

  function onContext(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    ui.select(node.path, node.is_dir);
    ui.showMenu(e.clientX, e.clientY, nodeMenuItems(node));
  }

</script>

{#snippet ficon(name: string, isDir: boolean)}
  <svg class="fticon" viewBox="0 0 24 24" width="16" height="16">{@html iconFor(name, isDir)}</svg>
{/snippet}

<ul class="filetree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button
          class="row dir"
          class:selected={ui.selectedPath === node.path}
          class:drop-target={drag.dropPath === node.path}
          data-path={node.path}
          use:draggable={() => ({ kind: "node", path: node.path, label: node.name })}
          onclick={(e) => {
            ui.select(node.path, true);
            (e.currentTarget as HTMLElement).focus();
            toggle(node.path);
          }}
          oncontextmenu={(e) => onContext(e, node)}
        >
          <span class="caret" class:open={expanded[node.path]}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m5.5 3.5 5 4.5-5 4.5" />
            </svg>
          </span>
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
          class:drop-into={drag.dropPath !== null && drag.dropPath === parentDir(node.path)}
          data-path={node.path}
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
