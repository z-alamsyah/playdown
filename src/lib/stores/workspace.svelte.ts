import { open } from "@tauri-apps/plugin-dialog";
import type { FileNode } from "../types";
import { listDirTree } from "../tauri/fs";
import { settings } from "./settings.svelte";

/** Holds the currently opened folder and its markdown file tree. */
class Workspace {
  root = $state<string | null>(null);
  rootName = $state("");
  tree = $state<FileNode[]>([]);
  loading = $state(false);

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
    } catch (e) {
      console.error("Failed to list directory:", e);
      this.tree = [];
    } finally {
      this.loading = false;
    }
  }

  async refresh() {
    if (this.root) await this.setRoot(this.root);
  }
}

export const workspace = new Workspace();
