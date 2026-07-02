import { open } from "@tauri-apps/plugin-dialog";
import type { FileNode, FlatFile } from "../types";
import { listDirTree, createFile, createDir, watchDir } from "../tauri/fs";
import { settings } from "./settings.svelte";

/** Holds the currently opened folder and its markdown file tree. */
class Workspace {
  root = $state<string | null>(null);
  rootName = $state("");
  tree = $state<FileNode[]>([]);
  loading = $state(false);

  /** Flattened list of files (for the quick-open palette). */
  get files(): FlatFile[] {
    const out: FlatFile[] = [];
    const rootLen = (this.root?.length ?? 0) + 1;
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.is_dir) {
          if (n.children) walk(n.children);
        } else {
          out.push({ name: n.name, path: n.path, rel: n.path.slice(rootLen) });
        }
      }
    };
    walk(this.tree);
    return out;
  }

  async openFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      await this.setRoot(selected);
      await settings.setLastFolder(selected);
    }
  }

  async setRoot(path: string) {
    this.loading = true;
    this.root = path;
    this.rootName = path.split(/[/\\]/).filter(Boolean).pop() ?? path;
    try {
      this.tree = await listDirTree(path);
      await settings.setLastFolder(path);
      void watchDir(path).catch(() => {}); // auto-reload open files on external edits
    } catch (e) {
      console.error("Failed to list directory:", e);
      this.tree = [];
    } finally {
      this.loading = false;
    }
  }

  /** Close the current folder — clears the tree and forgets it for next launch. */
  async clear() {
    this.root = null;
    this.rootName = "";
    this.tree = [];
    await settings.setLastFolder(null);
  }

  /** Re-read the tree in place (no loading flip) so the sidebar keeps its
   *  expanded folders + selection after a create/rename/delete/move. */
  async refresh() {
    if (!this.root) return;
    try {
      this.tree = await listDirTree(this.root);
    } catch (e) {
      console.error("Failed to refresh tree:", e);
    }
  }

  /** Path relative to the workspace root (for "copy relative path"). */
  relativeOf(path: string): string {
    if (!this.root) return path;
    const root = this.root.replace(/[/\\]+$/, "");
    return path.startsWith(root) ? path.slice(root.length + 1) : path;
  }

  /** Create a file or folder named `name` inside `parentDir`; returns full path. */
  async createEntry(parentDir: string, name: string, isDir: boolean): Promise<string | null> {
    const sep = parentDir.includes("\\") ? "\\" : "/";
    const full = parentDir.replace(/[/\\]+$/, "") + sep + name.trim();
    try {
      if (isDir) await createDir(full);
      else await createFile(full);
      await this.refresh();
      return full;
    } catch (e) {
      console.error("Failed to create entry:", e);
      return null;
    }
  }
}

export const workspace = new Workspace();
