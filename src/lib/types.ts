export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

/** A flattened file entry used by the quick-open palette. */
export interface FlatFile {
  name: string;
  path: string;
  rel: string;
}

/** The actual editable buffer for a file path, shared across all groups. */
export interface Doc {
  content: string;
  saved: string;
}

/** A tab is just a reference to a document by path. */
export interface Tab {
  path: string;
  name: string;
}

export type ViewMode = "edit" | "preview";
export type Theme = "dark" | "light";
export type Side = "left" | "right";
export type Direction = "row" | "column";
export type DropEdge = "center" | "left" | "right" | "top" | "bottom";

/** One editor group: its own tab strip, active tab and view mode. */
export interface EditorGroup {
  id: string;
  tabs: Tab[];
  activeIndex: number;
  viewMode: ViewMode;
}

/** Recursive split layout. Leaves point at a group id. */
export type LayoutNode =
  | { type: "leaf"; groupId: string; size: number }
  | { type: "split"; id: string; direction: Direction; children: LayoutNode[]; size: number };
