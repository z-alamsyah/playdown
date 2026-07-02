import { drag, type DragData } from "../stores/drag.svelte";

const THRESHOLD = 5; // px before a press becomes a drag

/**
 * Pointer-based drag source (Svelte action). HTML5 drag-and-drop is unusable
 * while Tauri's OS drag-drop is enabled, so we roll our own: once the pointer
 * moves past a small threshold we publish `drag.data`; drop targets read it on
 * their own `pointerup` (which fires before ours), and we clear it next frame.
 */
export function draggable(node: HTMLElement, getData: () => DragData | null) {
  let sx = 0;
  let sy = 0;
  let armed = false;
  let dragging = false;

  function swallow(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    // Don't hijack presses on the close button etc.
    if ((e.target as HTMLElement).closest(".close, .tt-kill")) return;
    sx = e.clientX;
    sy = e.clientY;
    armed = true;
    dragging = false;
    window.addEventListener("pointermove", move);
    // Capture phase: runs even if a drop target calls stopPropagation on
    // pointerup, so the drag always cleans up (no ghost stuck to the cursor).
    window.addEventListener("pointerup", up, true);
  }

  function move(e: PointerEvent) {
    if (!armed) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < THRESHOLD) return;
      const d = getData();
      if (!d) {
        stop();
        return;
      }
      dragging = true;
      drag.data = d;
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  }

  function up() {
    stop();
    if (dragging) {
      dragging = false;
      // Swallow the click a drag would otherwise fire on the source element.
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      requestAnimationFrame(() => (drag.data = null));
    }
  }

  function stop() {
    armed = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up, true);
  }

  node.addEventListener("pointerdown", down);
  return {
    destroy() {
      node.removeEventListener("pointerdown", down);
      stop();
    },
  };
}
