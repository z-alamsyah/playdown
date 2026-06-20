import { ui, type MenuItem } from "./stores/ui.svelte";
import { workspace } from "./stores/workspace.svelte";
import { groups } from "./stores/groups.svelte";
import { copyText } from "./tauri/clipboard";
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

/** Right-click menu items for a file-tree node. */
export function nodeMenuItems(node: FileNode): MenuItem[] {
  const dir = node.is_dir ? node.path : parentDir(node.path);
  return [
    { label: "Copy Path", action: () => void copyText(node.path) },
    { label: "Copy Relative Path", action: () => void copyText(workspace.relativeOf(node.path)) },
    { label: "New File…", separator: true, action: () => promptNewEntry(dir, false) },
    { label: "New Folder…", action: () => promptNewEntry(dir, true) },
  ];
}
