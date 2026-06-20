import type {
  Doc,
  Tab,
  EditorGroup,
  LayoutNode,
  ViewMode,
  Direction,
  DropEdge,
} from "../types";
import { EditorView } from "@codemirror/view";
import { readFile, writeFile } from "../tauri/fs";
import type { Heading } from "../markdown/render";

function uid(): string {
  return crypto.randomUUID();
}

function baseName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}

export interface SessionState {
  layout: LayoutNode | null;
  groups: Array<{
    id: string;
    viewMode: ViewMode;
    activeIndex: number;
    tabPaths: string[];
  }>;
  activeGroupId: string;
}

/**
 * The editor model: a map of open documents (shared buffers keyed by path),
 * a list of editor groups, and a recursive split layout referencing them.
 */
class GroupsStore {
  documents = $state<Record<string, Doc>>({});
  groups = $state<EditorGroup[]>([]);
  layout = $state<LayoutNode | null>(null);
  activeGroupId = $state("");

  // Imperative registries (non-reactive) for outline navigation.
  private editors = new Map<string, EditorView>();
  private previews = new Map<string, HTMLElement>();

  // ---- getters -------------------------------------------------------------
  get activeGroup(): EditorGroup | null {
    return (
      this.groups.find((g) => g.id === this.activeGroupId) ??
      this.groups[0] ??
      null
    );
  }

  get activeTab(): Tab | null {
    const g = this.activeGroup;
    return g && g.activeIndex >= 0 ? g.tabs[g.activeIndex] ?? null : null;
  }

  group(id: string): EditorGroup | null {
    return this.groups.find((g) => g.id === id) ?? null;
  }

  groupActiveTab(g: EditorGroup): Tab | null {
    return g.activeIndex >= 0 ? g.tabs[g.activeIndex] ?? null : null;
  }

  // ---- documents -----------------------------------------------------------
  docContent(path: string): string {
    return this.documents[path]?.content ?? "";
  }

  setDocContent(path: string, content: string) {
    const doc = this.documents[path];
    if (doc) doc.content = content;
  }

  isDirtyPath(path: string): boolean {
    const doc = this.documents[path];
    return !!doc && doc.content !== doc.saved;
  }

  async saveDoc(path: string) {
    const doc = this.documents[path];
    if (!doc || doc.content === doc.saved) return;
    await writeFile(path, doc.content);
    doc.saved = doc.content;
  }

  saveActive() {
    const t = this.activeTab;
    if (t) return this.saveDoc(t.path);
  }

  private async ensureDoc(path: string) {
    if (!this.documents[path]) {
      const content = await readFile(path);
      this.documents[path] = { content, saved: content };
    }
  }

  // ---- group lifecycle -----------------------------------------------------
  private newGroup(viewMode: ViewMode = "edit"): EditorGroup {
    return { id: uid(), tabs: [], activeIndex: -1, viewMode };
  }

  ensureInitial() {
    if (this.groups.length === 0 || !this.layout) {
      const g = this.newGroup();
      this.groups = [g];
      this.layout = { type: "leaf", groupId: g.id, size: 1 };
      this.activeGroupId = g.id;
    }
  }

  setActiveGroup(id: string) {
    if (this.group(id)) this.activeGroupId = id;
  }

  // ---- opening files -------------------------------------------------------
  async openFile(path: string, name?: string, groupId?: string) {
    this.ensureInitial();
    const g = groupId ? this.group(groupId) : this.activeGroup;
    if (!g) return;
    this.activeGroupId = g.id;

    const existing = g.tabs.findIndex((t) => t.path === path);
    if (existing >= 0) {
      g.activeIndex = existing;
      return;
    }
    await this.ensureDoc(path);
    g.tabs.push({ path, name: name ?? baseName(path) });
    g.activeIndex = g.tabs.length - 1;
  }

  // ---- tab navigation ------------------------------------------------------
  setActiveTab(groupId: string, index: number) {
    const g = this.group(groupId);
    if (!g) return;
    if (index >= 0 && index < g.tabs.length) {
      g.activeIndex = index;
      this.activeGroupId = groupId;
    }
  }

  nextTab() {
    const g = this.activeGroup;
    if (g && g.tabs.length) g.activeIndex = (g.activeIndex + 1) % g.tabs.length;
  }

  prevTab() {
    const g = this.activeGroup;
    if (g && g.tabs.length)
      g.activeIndex = (g.activeIndex - 1 + g.tabs.length) % g.tabs.length;
  }

  selectTab(n: number) {
    const g = this.activeGroup;
    if (g && n >= 0 && n < g.tabs.length) g.activeIndex = n;
  }

  focusAdjacentGroup(dir: 1 | -1) {
    if (this.groups.length < 2) return;
    const idx = this.groups.findIndex((g) => g.id === this.activeGroupId);
    const next = (idx + dir + this.groups.length) % this.groups.length;
    this.activeGroupId = this.groups[next].id;
  }

  // ---- outline navigation --------------------------------------------------
  registerEditor(groupId: string, view: EditorView) {
    this.editors.set(groupId, view);
  }
  unregisterEditor(groupId: string) {
    this.editors.delete(groupId);
  }
  registerPreview(groupId: string, el: HTMLElement) {
    this.previews.set(groupId, el);
  }
  unregisterPreview(groupId: string) {
    this.previews.delete(groupId);
  }

  /** Scroll the active group's view to a heading. */
  scrollToHeading(h: Heading) {
    const g = this.activeGroup;
    if (!g) return;
    if (g.viewMode === "edit") {
      const view = this.editors.get(g.id);
      if (!view) return;
      const lineNo = Math.min(h.line + 1, view.state.doc.lines);
      const line = view.state.doc.line(lineNo);
      view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      });
      view.focus();
    } else {
      const el = this.previews.get(g.id);
      const target = el?.querySelector<HTMLElement>(
        `#${CSS.escape(h.slug)}`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ---- view mode -----------------------------------------------------------
  setViewMode(groupId: string, mode: ViewMode) {
    const g = this.group(groupId);
    if (g) g.viewMode = mode;
  }

  toggleViewActive() {
    const g = this.activeGroup;
    if (g) g.viewMode = g.viewMode === "edit" ? "preview" : "edit";
  }

  // ---- closing -------------------------------------------------------------
  closeTab(groupId: string, index: number) {
    const g = this.group(groupId);
    if (!g) return;
    g.tabs.splice(index, 1);
    if (g.tabs.length === 0) {
      if (this.groups.length > 1) {
        this.closeGroup(groupId);
        return;
      }
      g.activeIndex = -1;
    } else if (g.activeIndex >= g.tabs.length) {
      g.activeIndex = g.tabs.length - 1;
    }
  }

  closeGroup(id: string) {
    if (this.groups.length <= 1 || !this.layout) return;
    this.groups = this.groups.filter((g) => g.id !== id);
    this.layout = this.removeLeaf(this.layout, id);
    if (this.activeGroupId === id) {
      this.activeGroupId = this.groups[0]?.id ?? "";
    }
  }

  // ---- split / move (drag-drop) --------------------------------------------
  /** Move a tab into another group (center drop), or reorder within a group. */
  moveTab(fromId: string, fromIndex: number, toId: string, toIndex?: number) {
    const from = this.group(fromId);
    const to = this.group(toId);
    if (!from || !to) return;
    const tab = from.tabs[fromIndex];
    if (!tab) return;

    if (fromId === toId) {
      // reorder
      from.tabs.splice(fromIndex, 1);
      let at = toIndex ?? from.tabs.length;
      if (at > fromIndex) at -= 1;
      from.tabs.splice(at, 0, tab);
      from.activeIndex = from.tabs.indexOf(tab);
      return;
    }

    from.tabs.splice(fromIndex, 1);
    const existing = to.tabs.findIndex((t) => t.path === tab.path);
    if (existing >= 0) {
      to.activeIndex = existing;
    } else {
      const at = toIndex ?? to.tabs.length;
      to.tabs.splice(at, 0, { path: tab.path, name: tab.name });
      to.activeIndex = to.tabs.findIndex((t) => t.path === tab.path);
    }
    this.activeGroupId = to.id;

    if (from.tabs.length === 0) this.closeGroup(fromId);
    else if (from.activeIndex >= from.tabs.length)
      from.activeIndex = from.tabs.length - 1;
  }

  /** Drop a tab onto an edge of a target group -> split and place it there. */
  splitWithTab(
    fromId: string,
    fromIndex: number,
    targetId: string,
    edge: DropEdge,
  ) {
    if (edge === "center") {
      this.moveTab(fromId, fromIndex, targetId);
      return;
    }
    const from = this.group(fromId);
    if (!from || !this.layout) return;
    const tab = from.tabs[fromIndex];
    if (!tab) return;
    // No-op: splitting a single-tab group against itself.
    if (fromId === targetId && from.tabs.length <= 1) return;

    const ng = this.newGroup(from.viewMode);
    from.tabs.splice(fromIndex, 1);
    ng.tabs.push({ path: tab.path, name: tab.name });
    ng.activeIndex = 0;

    this.groups.push(ng);
    this.insertSplit(targetId, ng.id, edge);
    this.activeGroupId = ng.id;

    if (from.tabs.length === 0) this.closeGroup(fromId);
    else if (from.activeIndex >= from.tabs.length)
      from.activeIndex = from.tabs.length - 1;
  }

  /** Split the active group to the right, showing the same file as a preview. */
  splitActive(edge: DropEdge = "right") {
    this.ensureInitial();
    const g = this.activeGroup;
    if (!g) return;
    const t = this.groupActiveTab(g);
    const ng = this.newGroup(t ? "preview" : g.viewMode);
    if (t) {
      ng.tabs.push({ path: t.path, name: t.name });
      ng.activeIndex = 0;
    }
    this.groups.push(ng);
    this.insertSplit(g.id, ng.id, edge);
    this.activeGroupId = ng.id;
  }

  // ---- layout tree helpers -------------------------------------------------
  private insertSplit(targetId: string, newGroupId: string, edge: DropEdge) {
    if (!this.layout) return;
    const direction: Direction =
      edge === "left" || edge === "right" ? "row" : "column";
    const before = edge === "left" || edge === "top";
    this.layout = this.replaceLeaf(this.layout, targetId, (leaf) => {
      const newLeaf: LayoutNode = { type: "leaf", groupId: newGroupId, size: 1 };
      const targetLeaf: LayoutNode = { ...leaf, size: 1 };
      return {
        type: "split",
        id: uid(),
        direction,
        size: leaf.size,
        children: before ? [newLeaf, targetLeaf] : [targetLeaf, newLeaf],
      };
    });
  }

  private replaceLeaf(
    node: LayoutNode,
    groupId: string,
    fn: (leaf: Extract<LayoutNode, { type: "leaf" }>) => LayoutNode,
  ): LayoutNode {
    if (node.type === "leaf") {
      return node.groupId === groupId ? fn(node) : node;
    }
    return {
      ...node,
      children: node.children.map((c) => this.replaceLeaf(c, groupId, fn)),
    };
  }

  private removeLeaf(node: LayoutNode, groupId: string): LayoutNode {
    if (node.type === "leaf") return node;
    const children = node.children
      .map((c) => this.removeLeaf(c, groupId))
      .filter((c) => !(c.type === "leaf" && c.groupId === groupId));
    if (children.length === 1) {
      // collapse single-child split, preserving the parent's size slot
      return { ...children[0], size: node.size };
    }
    return { ...node, children };
  }

  resize(node: LayoutNode, index: number, sizes: number[]) {
    if (node.type !== "split") return;
    node.children.forEach((c, i) => {
      if (sizes[i] !== undefined) c.size = sizes[i];
    });
  }

  // ---- session persistence -------------------------------------------------
  serialize(): SessionState {
    return {
      layout: $state.snapshot(this.layout) as LayoutNode | null,
      groups: this.groups.map((g) => ({
        id: g.id,
        viewMode: g.viewMode,
        activeIndex: g.activeIndex,
        tabPaths: g.tabs.map((t) => t.path),
      })),
      activeGroupId: this.activeGroupId,
    };
  }

  async restore(state: SessionState | null): Promise<boolean> {
    if (!state || !state.layout || !state.groups?.length) return false;
    try {
      const groups: EditorGroup[] = [];
      for (const g of state.groups) {
        const tabs: Tab[] = [];
        for (const path of g.tabPaths) {
          try {
            await this.ensureDoc(path);
            tabs.push({ path, name: baseName(path) });
          } catch {
            /* file gone — skip */
          }
        }
        groups.push({
          id: g.id,
          tabs,
          activeIndex: Math.min(g.activeIndex, tabs.length - 1),
          viewMode: g.viewMode,
        });
      }
      // Prune layout leaves for groups that ended up empty.
      const nonEmpty = new Set(groups.filter((g) => g.tabs.length).map((g) => g.id));
      if (nonEmpty.size === 0) return false;
      let layout: LayoutNode | null = state.layout;
      for (const g of groups) {
        if (!nonEmpty.has(g.id) && layout) layout = this.removeLeaf(layout, g.id);
      }
      this.groups = groups.filter((g) => nonEmpty.has(g.id));
      this.layout = layout;
      this.activeGroupId = nonEmpty.has(state.activeGroupId)
        ? state.activeGroupId
        : this.groups[0].id;
      return true;
    } catch (e) {
      console.error("Failed to restore session:", e);
      return false;
    }
  }
}

export const groups = new GroupsStore();
