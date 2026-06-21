import { invoke } from "@tauri-apps/api/core";
import type { FileNode } from "../types";

/** Recursively list markdown files/folders under `path` (Rust command). */
export const listDirTree = (path: string) =>
  invoke<FileNode[]>("list_dir_tree", { path });

/** True if the path is a directory (Rust command). */
export const isDir = (path: string) => invoke<boolean>("is_dir", { path });

/** Read a UTF-8 text file (Rust command). */
export const readFile = (path: string) => invoke<string>("read_file", { path });

/** Write a UTF-8 text file (Rust command). */
export const writeFile = (path: string, contents: string) =>
  invoke<void>("write_file", { path, contents });

/** Create a new empty file (errors if it already exists). */
export const createFile = (path: string) => invoke<void>("create_file", { path });

/** Create a new directory (errors if it already exists). */
export const createDir = (path: string) => invoke<void>("create_dir", { path });

/** Move a file/folder to the OS trash (recoverable). */
export const deletePath = (path: string) => invoke<void>("delete_path", { path });

/** Rename (or move) a file/folder. */
export const renamePath = (from: string, to: string) =>
  invoke<void>("rename_path", { from, to });

/** Read an image as a base64 data URL. */
export const readImageDataUrl = (path: string) =>
  invoke<string>("read_image_data_url", { path });
