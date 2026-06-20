export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface Tab {
  path: string;
  name: string;
  /** Current editor content. */
  content: string;
  /** Last content written to disk — used for the dirty check. */
  saved: string;
}

export type ViewMode = "edit" | "preview";
export type Theme = "dark" | "light";
