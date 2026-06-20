import { invoke } from "@tauri-apps/api/core";
import type { FileNode } from "../types";

/** Recursively list markdown files/folders under `path` (Rust command). */
export const listDirTree = (path: string) =>
  invoke<FileNode[]>("list_dir_tree", { path });

/** Read a UTF-8 text file (Rust command). */
export const readFile = (path: string) => invoke<string>("read_file", { path });

/** Write a UTF-8 text file (Rust command). */
export const writeFile = (path: string, contents: string) =>
  invoke<void>("write_file", { path, contents });
