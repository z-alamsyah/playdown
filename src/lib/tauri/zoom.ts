import { getCurrentWebview } from "@tauri-apps/api/webview";
import { settings } from "../stores/settings.svelte";

const MIN = 0.5;
const MAX = 3;
const STEP = 0.1;

const clamp = (f: number) =>
  Math.min(MAX, Math.max(MIN, Math.round(f * 100) / 100));

/** Push the current zoom factor to the native webview. */
export function applyZoom() {
  void getCurrentWebview()
    .setZoom(settings.zoom)
    .catch((e) => console.error("setZoom failed:", e));
}

export function setZoom(factor: number) {
  void settings.setZoom(clamp(factor));
  applyZoom();
}

export function zoomIn() {
  setZoom(settings.zoom + STEP);
}

export function zoomOut() {
  setZoom(settings.zoom - STEP);
}

export function zoomReset() {
  setZoom(1);
}

export function zoomBy(delta: number) {
  setZoom(settings.zoom + delta);
}
