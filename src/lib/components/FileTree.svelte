<script lang="ts">
  import type { FileNode } from "../types";
  import { groups } from "../stores/groups.svelte";
  import { ui } from "../stores/ui.svelte";
  import { nodeMenuItems, moveEntry, importExternalFiles } from "../fileActions";
  import Self from "./FileTree.svelte";

  let { nodes, depth }: { nodes: FileNode[]; depth: number } = $props();

  let expanded = $state<Record<string, boolean>>({});
  let dragOver = $state<string | null>(null);

  const MIME = "application/x-playdown-move";

  function toggle(path: string) {
    expanded[path] = !expanded[path];
  }

  function onContext(e: MouseEvent, node: FileNode) {
    e.preventDefault();
    e.stopPropagation();
    ui.select(node.path, node.is_dir);
    ui.showMenu(e.clientX, e.clientY, nodeMenuItems(node));
  }

  function onDragStart(e: DragEvent, node: FileNode) {
    e.stopPropagation();
    e.dataTransfer?.setData(MIME, node.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }

  function isMove(e: DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes(MIME);
  }

  // External files dragged from Finder / Explorer carry the "Files" type.
  function hasFiles(e: DragEvent) {
    return Array.from(e.dataTransfer?.types ?? []).includes("Files");
  }

  function onDirOver(e: DragEvent, node: FileNode) {
    const external = hasFiles(e);
    if (!isMove(e) && !external) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = external ? "copy" : "move";
    dragOver = node.path;
  }

  function onDirDrop(e: DragEvent, node: FileNode) {
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      e.preventDefault();
      e.stopPropagation();
      dragOver = null;
      void importExternalFiles(files, node.path);
      return;
    }
    if (!isMove(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const src = e.dataTransfer?.getData(MIME);
    dragOver = null;
    if (src) void moveEntry(src, node.path);
  }
</script>

<ul class="filetree" class:nested={depth > 0}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.is_dir}
        <button
          class="row dir"
          class:selected={ui.selectedPath === node.path}
          class:drop-target={dragOver === node.path}
          draggable="true"
          ondragstart={(e) => onDragStart(e, node)}
          ondragover={(e) => onDirOver(e, node)}
          ondragleave={() => (dragOver = null)}
          ondrop={(e) => onDirDrop(e, node)}
          onclick={(e) => {
            ui.select(node.path, true);
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
          draggable="true"
          ondragstart={(e) => onDragStart(e, node)}
          onclick={(e) => {
            ui.select(node.path, false);
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
