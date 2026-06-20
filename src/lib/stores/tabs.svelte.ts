import type { Tab } from "../types";
import { readFile, writeFile } from "../tauri/fs";

/** Open markdown buffers and the active selection. */
class TabsStore {
  tabs = $state<Tab[]>([]);
  activeIndex = $state(-1);

  get active(): Tab | null {
    return this.activeIndex >= 0 ? this.tabs[this.activeIndex] ?? null : null;
  }

  isDirty(tab: Tab): boolean {
    return tab.content !== tab.saved;
  }

  /** Open a file in a new tab, or focus it if already open. */
  async open(path: string, name: string) {
    const existing = this.tabs.findIndex((t) => t.path === path);
    if (existing >= 0) {
      this.activeIndex = existing;
      return;
    }
    const content = await readFile(path);
    this.tabs.push({ path, name, content, saved: content });
    this.activeIndex = this.tabs.length - 1;
  }

  setContent(content: string) {
    const t = this.active;
    if (t) t.content = content;
  }

  async save() {
    const t = this.active;
    if (!t || !this.isDirty(t)) return;
    await writeFile(t.path, t.content);
    t.saved = t.content;
  }

  close(index: number) {
    this.tabs.splice(index, 1);
    if (this.tabs.length === 0) {
      this.activeIndex = -1;
    } else if (this.activeIndex >= this.tabs.length) {
      this.activeIndex = this.tabs.length - 1;
    }
  }

  setActive(index: number) {
    if (index >= 0 && index < this.tabs.length) this.activeIndex = index;
  }

  openPaths(): string[] {
    return this.tabs.map((t) => t.path);
  }
}

export const tabs = new TabsStore();
