import { settings } from "./settings.svelte";

export type Action =
  | "openFolder"
  | "quickOpen"
  | "save"
  | "gotoLine"
  | "toggleView"
  | "toggleSidebar"
  | "toggleOutline"
  | "closeTab"
  | "closeOtherTabs"
  | "closeAllTabs"
  | "splitRight"
  | "nextTab"
  | "prevTab"
  | "focusNextGroup"
  | "focusPrevGroup"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "formatDoc"
  | "toggleTerminal"
  | "newTerminal"
  | "nextTerminal"
  | "prevTerminal"
  | "closeTerminal"
  | "focusTerminal"
  | "openSettings";

export interface ActionDef {
  id: Action;
  label: string;
}

export const ACTIONS: ActionDef[] = [
  { id: "openFolder", label: "Open folder" },
  { id: "quickOpen", label: "Quick open (find file)" },
  { id: "save", label: "Save file" },
  { id: "gotoLine", label: "Go to line" },
  { id: "toggleView", label: "Toggle edit / preview" },
  { id: "toggleSidebar", label: "Toggle sidebar" },
  { id: "toggleOutline", label: "Toggle outline" },
  { id: "closeTab", label: "Close tab" },
  { id: "closeOtherTabs", label: "Close other tabs" },
  { id: "closeAllTabs", label: "Close all tabs" },
  { id: "splitRight", label: "Split right" },
  { id: "nextTab", label: "Next tab" },
  { id: "prevTab", label: "Previous tab" },
  { id: "focusNextGroup", label: "Focus next group" },
  { id: "focusPrevGroup", label: "Focus previous group" },
  { id: "zoomIn", label: "Zoom in" },
  { id: "zoomOut", label: "Zoom out" },
  { id: "zoomReset", label: "Reset zoom" },
  { id: "formatDoc", label: "Format JSON" },
  { id: "toggleTerminal", label: "Toggle terminal" },
  { id: "newTerminal", label: "New terminal session" },
  { id: "nextTerminal", label: "Next terminal session" },
  { id: "prevTerminal", label: "Previous terminal session" },
  { id: "closeTerminal", label: "Close terminal session" },
  { id: "focusTerminal", label: "Focus terminal / editor" },
  { id: "openSettings", label: "Open settings" },
];

const DEFAULTS: Record<Action, string> = {
  openFolder: "Mod+O",
  quickOpen: "Mod+P",
  save: "Mod+S",
  gotoLine: "Mod+G",
  toggleView: "Mod+E",
  toggleSidebar: "Mod+B",
  toggleOutline: "Mod+Shift+O",
  closeTab: "Mod+W",
  closeOtherTabs: "Mod+Alt+W",
  closeAllTabs: "Mod+Shift+W",
  splitRight: "Mod+\\",
  nextTab: "Ctrl+Tab",
  prevTab: "Ctrl+Shift+Tab",
  focusNextGroup: "Mod+Alt+ArrowRight",
  focusPrevGroup: "Mod+Alt+ArrowLeft",
  zoomIn: "Mod+=",
  zoomOut: "Mod+-",
  zoomReset: "Mod+0",
  formatDoc: "Mod+Shift+F",
  toggleTerminal: "Ctrl+`",
  newTerminal: "Mod+T",
  nextTerminal: "Mod+Alt+ArrowDown",
  prevTerminal: "Mod+Alt+ArrowUp",
  closeTerminal: "Mod+X",
  focusTerminal: "Mod+J",
  openSettings: "Mod+,",
};

export const IS_MAC =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

function normalizeKey(e: KeyboardEvent): string {
  const k = e.key;
  if (k === " ") return "Space";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

/** Serialize a keyboard event to a binding string, or "" for a lone modifier. */
export function eventToCombo(e: KeyboardEvent): string {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return "";
  const primary = IS_MAC ? e.metaKey : e.ctrlKey;
  const parts: string[] = [];
  if (primary) parts.push("Mod");
  if (IS_MAC && e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(normalizeKey(e));
  return parts.join("+");
}

export function prettyCombo(combo: string): string {
  const map: Record<string, string> = {
    Mod: IS_MAC ? "⌘" : "Ctrl",
    Alt: IS_MAC ? "⌥" : "Alt",
    Shift: IS_MAC ? "⇧" : "Shift",
    Ctrl: IS_MAC ? "⌃" : "Ctrl",
    ArrowRight: "→",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Space: "Space",
  };
  const sep = IS_MAC ? "" : "+";
  return combo
    .split("+")
    .map((p) => map[p] ?? p)
    .join(sep);
}

class Keymap {
  overrides = $state<Partial<Record<Action, string>>>({});

  get bindings(): Record<Action, string> {
    return { ...DEFAULTS, ...this.overrides };
  }

  combo(action: Action): string {
    return this.bindings[action];
  }

  hydrate(overrides: Partial<Record<Action, string>> | null) {
    this.overrides = overrides ?? {};
  }

  match(e: KeyboardEvent): Action | null {
    const combo = eventToCombo(e);
    if (!combo) return null;
    const b = this.bindings;
    for (const key of Object.keys(b) as Action[]) {
      if (b[key] === combo) return key;
    }
    return null;
  }

  set(action: Action, combo: string) {
    this.overrides = { ...this.overrides, [action]: combo };
    void settings.setKeymap(this.overrides);
  }

  reset(action: Action) {
    const next = { ...this.overrides };
    delete next[action];
    this.overrides = next;
    void settings.setKeymap(this.overrides);
  }

  resetAll() {
    this.overrides = {};
    void settings.setKeymap(this.overrides);
  }
}

export const keymap = new Keymap();
