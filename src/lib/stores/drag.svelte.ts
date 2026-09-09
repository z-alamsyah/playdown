/** Active in-app drag (pointer-based, so it works with Tauri's OS drag-drop
 *  enabled). `data` is null when nothing is being dragged. */
export type DragData =
  | { kind: "tab"; groupId: string; index: number; label: string }
  | { kind: "node"; path: string; label: string };

class DragStore {
  data = $state<DragData | null>(null);
  x = $state(0);
  y = $state(0);
  /** Folder a dragged sidebar node would land in, resolved from the pointer
   *  position by the sidebar. Single source of truth: what is highlighted is
   *  exactly where the drop lands. Null when the pointer is over no valid
   *  target (outside the tree, or a move that would be a no-op). */
  dropPath = $state<string | null>(null);
  /** Display name of dropPath, shown on the drag ghost. */
  dropLabel = $state("");
}

export const drag = new DragStore();
