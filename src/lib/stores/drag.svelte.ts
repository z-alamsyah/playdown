/** Active in-app drag (pointer-based, so it works with Tauri's OS drag-drop
 *  enabled). `data` is null when nothing is being dragged. */
export type DragData =
  | { kind: "tab"; groupId: string; index: number; label: string }
  | { kind: "node"; path: string; label: string };

class DragStore {
  data = $state<DragData | null>(null);
  x = $state(0);
  y = $state(0);
}

export const drag = new DragStore();
