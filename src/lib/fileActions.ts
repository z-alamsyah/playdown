import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, type MenuItem } from "./stores/ui.svelte";
import { workspace } from "./stores/workspace.svelte";
import { groups } from "./stores/groups.svelte";
import { copyText } from "./tauri/clipboard";
import { deletePath } from "./tauri/fs";
import type { FileNode } from "./types";

export function parentDir(p: string): string {
  return p.replace(/[/\\][^/\\]*$/, "") || p;
}

/** Open the name prompt to create a file or folder inside `dir`. */
export function promptNewEntry(dir: string, isDir: boolean) {
  ui.showPrompt({
    title: isDir ? "New Folder" : "New File",
    placeholder: isDir ? "folder-name" : "name.md",
    confirmLabel: "Create",
    onSubmit: async (name) => {
      const full = await workspace.createEntry(dir, name, isDir);
      ui.closePrompt();
      if (full && !isDir) await groups.openFile(full);
    },
  });
}

/** Confirm, then move a file/folder to Trash and close any open tabs. */
export async function deleteEntry(node: FileNode) {
  const ok = await confirm(`Move "${node.name}" to Trash?`, {
    title: "Delete",
    kind: "warning",
  });
  if (!ok) return;
  try {
    await deletePath(node.path);
    groups.closeUnder(node.path);
    await workspace.refresh();
  } catch (e) {
    console.error("Delete failed:", e);
  }
}

/** Right-click menu items for a file-tree node. */
export function nodeMenuItems(node: FileNode): MenuItem[] {
  const dir = node.is_dir ? node.path : parentDir(node.path);
  return [
    { label: "Copy Path", action: () => void copyText(node.path) },
    { label: "Copy Relative Path", action: () => void copyText(workspace.relativeOf(node.path)) },
    { label: "New File…", separator: true, action: () => promptNewEntry(dir, false) },
    { label: "New Folder…", action: () => promptNewEntry(dir, true) },
    { label: "Delete", danger: true, separator: true, action: () => void deleteEntry(node) },
  ];
}
