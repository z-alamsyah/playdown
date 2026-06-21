<script lang="ts">
  import type { FileNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import { ui } from "../stores/ui.svelte";
  import { nodeMenuItems } from "../fileActions";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }

  function onContext(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    ui.selectedPath = node.path;
    ui.showMenu(e.clientX, e.clientY, nodeMenuItems(node));
  }
</script>

<ul class="filetree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button
          class="row dir"
          class:selected={ui.selectedPath === node.path}
          onclick={(e) => {
            ui.selectedPath = node.path;
            (e.currentTarget as HTMLElement).focus();
            toggle(node.path);
          }}
          oncontextmenu={(e) => onContext(e, node)}
        >
          <span class="caret">{expanded[node.path] ? "▾" : "▸"}</span>
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
          onclick={(e) => {
            ui.selectedPath = node.path;
            (e.currentTarget as HTMLElement).focus();
            groups.openFile(node.path, node.name);
          }}
          oncontextmenu={(e) => onContext(e, node)}
        >
          <span class="caret-spacer"></span>
          <span class="label">{node.name}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>
