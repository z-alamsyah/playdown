<script lang="ts">
  import type { FileNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }
</script>

<ul class="filetree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button class="row dir" onclick={() => toggle(node.path)}>
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
          onclick={() => groups.openFile(node.path, node.name)}
        >
          <span class="caret-spacer"></span>
          <span class="label">{node.name}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>
