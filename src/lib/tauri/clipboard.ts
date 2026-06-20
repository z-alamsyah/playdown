import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export const copyText = (text: string) =>
  writeText(text).catch((e) => console.error("clipboard write failed:", e));
