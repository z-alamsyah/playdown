import { confirm } from "@tauri-apps/plugin-dialog";
import { ui, type MenuItem } from "./stores/ui.svelte";
import { workspace } from "./stores/workspace.svelte";
import { groups } from "./stores/groups.svelte";
import { copyText } from "./tauri/clipboard";
import { deletePath, renamePath, importFile } from "./tauri/fs";
import { invoke } from "@tauri-apps/api/core";
import { isHtml } from "./fileKind";
import type { FileNode } from "./types";

export function parentDir(p: string): string {
  return p.replace(/[/\\][^/\\]*$/, "") || p;
}

function baseName(p: string): string {
  return p.split(/[/\\]/).filter(Boolean).pop() ?? p;
}

/** The folder new files/folders should go into: the selected folder, the
 *  selected file's parent, or the workspace root. */
export function selectedDir(): string | null {
  if (ui.selectedPath) {
    return ui.selectedIsDir ? ui.selectedPath : parentDir(ui.selectedPath);
  }
  return workspace.root;
}

/** Move a file/folder into destDir (drag-and-drop). */
export async function moveEntry(src: string, destDir: string) {
  const srcBase = src.replace(/[/\\]+$/, "");
  const dest = destDir.replace(/[/\\]+$/, "") + "/" + baseName(src);
  if (dest === src) return; // already there
  // Can't move a folder into itself or a descendant.
  if (destDir === srcBase || destDir.startsWith(srcBase + "/")) return;
  try {
    await renamePath(src, dest);
    groups.renamePath(src, dest);
    if (ui.selectedPath === src) ui.selectedPath = dest;
    await workspace.refresh();
  } catch (e) {
    console.error("Move failed:", e);
  }
}

/** Copy files dropped from the OS file manager (Finder/Explorer) into `dir`.
 *  The webview can't see their source paths, so read the bytes and write them
 *  via Rust. Names that collide get a " (n)" suffix. */
export async function importExternalFiles(files: FileList, dir: string) {
  for (const file of Array.from(files)) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      await importFile(dir, file.name, btoa(bin));
    } catch (e) {
      console.error("Import failed:", file.name, e);
    }
  }
  await workspace.refresh();
}

/** Close the open folder → back to the welcome screen (confirms if unsaved). */
export async function closeFolder() {
  if (groups.anyDirty) {
    const ok = await confirm("Close the folder? Unsaved changes will be lost.", {
      title: "Close Folder",
      kind: "warning",
    });
    if (!ok) return;
  }
  groups.reset();
  ui.selectedPath = null;
  await workspace.clear();
}

/** Prompt to rename a file/folder by path; updates open tabs + tree. */
export function promptRename(path: string) {
  const current = baseName(path);
  ui.showPrompt({
    title: "Rename",
    value: current,
    placeholder: current,
    confirmLabel: "Rename",
    onSubmit: async (newName) => {
      ui.closePrompt();
      const trimmed = newName.trim();
      const parent = parentDir(path);
      const sep = parent.includes("\\") ? "\\" : "/";
      const dest = parent.replace(/[/\\]+$/, "") + sep + trimmed;
      if (!trimmed || dest === path) return;
      try {
        await renamePath(path, dest);
        groups.renamePath(path, dest);
        if (ui.selectedPath === path) ui.selectedPath = dest;
        await workspace.refresh();
      } catch (e) {
        console.error("Rename failed:", e);
      }
    },
  });
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

/** Open a file in the OS default browser (used for .html). */
export function openInBrowser(path: string) {
  void invoke("open_in_browser", { path }).catch((e) =>
    console.error("Open in browser failed:", e),
  );
}

/** Right-click menu items for a file-tree node. */
export function nodeMenuItems(node: FileNode): MenuItem[] {
  const dir = node.is_dir ? node.path : parentDir(node.path);
  const items: MenuItem[] = [
    { label: "Copy Path", action: () => void copyText(node.path) },
    { label: "Copy Relative Path", action: () => void copyText(workspace.relativeOf(node.path)) },
    { label: "Rename…", separator: true, action: () => promptRename(node.path) },
    { label: "New File…", action: () => promptNewEntry(dir, false) },
    { label: "New Folder…", action: () => promptNewEntry(dir, true) },
    { label: "Delete", danger: true, separator: true, action: () => void deleteEntry(node) },
  ];
  if (!node.is_dir && isHtml(node.path)) {
    items.unshift({ label: "Open in Browser", action: () => openInBrowser(node.path) });
  }
  return items;
}
