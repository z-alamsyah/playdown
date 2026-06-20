<script lang="ts">
  import type { FileNode } from "../types";
  import { tabs } from "../stores/tabs.svelte";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }
</script>

<ul class="filetree">
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button
          class="row dir"
          style="padding-left: {depth * 12 + 8}px"
          onclick={() => toggle(node.path)}
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
          class:active={tabs.active?.path === node.path}
          style="padding-left: {depth * 12 + 24}px"
          onclick={() => tabs.open(node.path, node.name)}
        >
          <span class="label">{node.name}</span>
        </button>
      {/if}
    </li>
  {/each}
</ul>
