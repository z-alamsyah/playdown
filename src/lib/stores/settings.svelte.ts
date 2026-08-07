import { LazyStore } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { Theme, Side, TitlebarColor, Dock } from "../types";
import type { SessionState } from "./groups.svelte";

const store = new LazyStore("settings.json");

// Per-window settings: each window (project) keeps its own folder, session, and
// titlebar color. The default "main" window uses the bare keys (back-compat);
// secondary windows suffix them so windows don't clobber each other. Everything
// else (theme, keymap, zoom, …) stays shared across windows.
let winLabel: string | null = null;
function windowLabel(): string {
  if (winLabel === null) {
    try {
      winLabel = getCurrentWindow().label;
    } catch {
      winLabel = "main";
    }
  }
  return winLabel;
}
const PER_WINDOW = new Set(["titlebarColor", "lastFolder", "session"]);
function storeKey(key: string): string {
  const w = windowLabel();
  return PER_WINDOW.has(key) && w !== "main" ? `${key}__${w}` : key;
}

/** Title bar palette → [background, foreground]. "plain" follows the theme. */
export const TITLEBAR_COLORS: Record<TitlebarColor, [string, string]> = {
  orange: ["#ff3e00", "#ffffff"],
  plain: ["var(--bg-elev)", "var(--text)"],
  skyblue: ["#0ea5e9", "#06283d"],
  darkred: ["#991b1b", "#ffffff"],
  green: ["#15803d", "#ffffff"],
};

/** Persisted preferences: theme, layout, zoom, keymap, and editor session. */
class Settings {
  theme = $state<Theme>("dark");
  lastFolder = $state<string | null>(null);
  session = $state<SessionState | null>(null);
  sidebarSide = $state<Side>("left");
  sidebarVisible = $state(true);
  outlineVisible = $state(false);
  zoom = $state(1);
  keymap = $state<Record<string, string>>({});
  titlebarColor = $state<TitlebarColor>("orange");
  terminalOpen = $state(false);
  terminalHeight = $state(240);
  terminalWidth = $state(480);
  terminalSide = $state<Dock>("bottom");
  annotationWidth = $state(280);
  sidebarWidth = $state(250);
  jsonSortKeys = $state(false);
  recentFolders = $state<string[]>([]);
  /** OS notification when a background agent needs input / finishes. */
  agentNotifications = $state(true);
  /** Command run by "New agent terminal" (command palette). */
  agentCommand = $state("claude");
  /** Remote access: bridge socket + supervised playdown-remote companion
   *  (phone terminal / Telegram). One switch — the bridge always comes up;
   *  the companion joins when its binary is installed. */
  remoteAccess = $state(false);
  /** Socket path while the bridge is running (not persisted). */
  bridgeSocket = $state<string | null>(null);
  /** Extra CLI args for the supervised companion (e.g. --telegram …). */
  remoteArgs = $state("");
  /** Ready info from the running companion (not persisted). */
  companion = $state<{
    urls: { url: string; kind: string; qr: string | null }[];
  } | null>(null);
  /** Remote is on but the companion binary isn't installed (bridge-only). */
  companionMissing = $state(false);
  loaded = $state(false);

  async load() {
    try {
      // Legacy migration: the short-lived "github-*" theme names collapsed
      // into plain dark/light (which now ARE the GitHub palettes).
      const rawTheme = await store.get<string>("theme");
      const theme = (
        rawTheme === "github-dark" ? "dark" : rawTheme === "github-light" ? "light" : rawTheme
      ) as Theme | undefined;
      const lastFolder = await store.get<string>(storeKey("lastFolder"));
      const session = await store.get<SessionState>(storeKey("session"));
      const sidebarSide = await store.get<Side>("sidebarSide");
      const sidebarVisible = await store.get<boolean>("sidebarVisible");
      const outlineVisible = await store.get<boolean>("outlineVisible");
      const zoom = await store.get<number>("zoom");
      const keymap = await store.get<Record<string, string>>("keymap");
      const titlebarColor = await store.get<TitlebarColor>(storeKey("titlebarColor"));
      const terminalHeight = await store.get<number>("terminalHeight");
      const terminalWidth = await store.get<number>("terminalWidth");
      const annotationWidth = await store.get<number>("annotationWidth");
      if (typeof annotationWidth === "number") this.annotationWidth = annotationWidth;
      const sidebarWidth = await store.get<number>("sidebarWidth");
      if (typeof sidebarWidth === "number") this.sidebarWidth = sidebarWidth;
      const jsonSortKeys = await store.get<boolean>("jsonSortKeys");
      if (typeof jsonSortKeys === "boolean") this.jsonSortKeys = jsonSortKeys;
      const recentFolders = await store.get<string[]>("recentFolders");
      if (Array.isArray(recentFolders)) this.recentFolders = recentFolders;
      const agentNotifications = await store.get<boolean>("agentNotifications");
      if (typeof agentNotifications === "boolean") this.agentNotifications = agentNotifications;
      const agentCommand = await store.get<string>("agentCommand");
      if (typeof agentCommand === "string" && agentCommand.trim()) this.agentCommand = agentCommand;
      const remoteArgs = await store.get<string>("remoteArgs");
      if (typeof remoteArgs === "string") this.remoteArgs = remoteArgs;
      // One flag since v0.14; migrate the two legacy toggles (bridge/phone).
      const remoteAccess = await store.get<boolean>("remoteAccess");
      const legacyBridge = await store.get<boolean>("remoteBridge");
      const legacyPhone = await store.get<boolean>("remotePhone");
      const remoteOn = remoteAccess === true || legacyBridge === true || legacyPhone === true;
      if (remoteAccess === undefined && (legacyBridge !== undefined || legacyPhone !== undefined)) {
        void this.persist("remoteAccess", remoteOn);
      }
      if (remoteOn) {
        this.remoteAccess = true;
        void invoke<string>("bridge_start")
          .then((p) => {
            this.bridgeSocket = p;
            // Companion needs the socket up first; a missing binary is fine.
            void this.tryStartCompanion().catch((e) => console.error("companion autostart failed:", e));
          })
          .catch((e) => console.error("bridge start failed:", e));
      }
      const terminalSide = await store.get<Dock>("terminalSide");
      const terminalOpen = await store.get<boolean>("terminalOpen");
      if (titlebarColor) this.titlebarColor = titlebarColor;
      if (typeof terminalHeight === "number") this.terminalHeight = terminalHeight;
      if (typeof terminalWidth === "number") this.terminalWidth = terminalWidth;
      if (terminalSide) this.terminalSide = terminalSide;
      if (typeof terminalOpen === "boolean") this.terminalOpen = terminalOpen;
      if (theme) this.theme = theme;
      if (lastFolder) this.lastFolder = lastFolder;
      if (session) this.session = session;
      if (sidebarSide) this.sidebarSide = sidebarSide;
      if (typeof sidebarVisible === "boolean") this.sidebarVisible = sidebarVisible;
      if (typeof outlineVisible === "boolean") this.outlineVisible = outlineVisible;
      if (typeof zoom === "number") this.zoom = zoom;
      if (keymap) this.keymap = keymap;
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    this.apply();
    this.loaded = true;
  }

  apply() {
    document.documentElement.dataset.theme = this.theme;
    this.applyTitlebar();
  }

  applyTitlebar() {
    const [bg, fg] = TITLEBAR_COLORS[this.titlebarColor] ?? TITLEBAR_COLORS.orange;
    document.documentElement.style.setProperty("--titlebar-bg", bg);
    document.documentElement.style.setProperty("--titlebar-fg", fg);
  }

  async setTitlebarColor(color: TitlebarColor) {
    this.titlebarColor = color;
    this.applyTitlebar();
    await this.persist("titlebarColor", color);
  }

  async setTerminalOpen(v: boolean) {
    this.terminalOpen = v;
    await this.persist("terminalOpen", v);
  }

  toggleTerminal() {
    void this.setTerminalOpen(!this.terminalOpen);
  }

  async setTerminalHeight(px: number) {
    this.terminalHeight = px;
    await this.persist("terminalHeight", px);
  }

  async setTerminalWidth(px: number) {
    this.terminalWidth = px;
    await this.persist("terminalWidth", px);
  }

  async setAnnotationWidth(px: number) {
    this.annotationWidth = px;
    await this.persist("annotationWidth", px);
  }

  async setSidebarWidth(px: number) {
    this.sidebarWidth = px;
    await this.persist("sidebarWidth", px);
  }

  async setJsonSortKeys(v: boolean) {
    this.jsonSortKeys = v;
    await this.persist("jsonSortKeys", v);
  }

  async setAgentNotifications(v: boolean) {
    this.agentNotifications = v;
    await this.persist("agentNotifications", v);
  }

  async setAgentCommand(cmd: string) {
    this.agentCommand = cmd.trim() || "claude";
    await this.persist("agentCommand", this.agentCommand);
  }

  /** Start the companion if its binary is installed; a missing binary is not
   *  an error (bridge stays useful for manual/custom companions). Throws on
   *  real start failures (port busy, bad args). */
  async tryStartCompanion() {
    this.companionMissing = false;
    const installed = await invoke<boolean>("remote_companion_installed");
    if (!installed) {
      this.companionMissing = true;
      this.companion = null;
      return;
    }
    const line = await invoke<string>("remote_companion_start", {
      extraArgs: this.remoteArgs.trim() || null,
    });
    const info = JSON.parse(line);
    this.companion = { urls: info.urls ?? [] };
  }

  async setRemoteAccess(v: boolean) {
    if (v) {
      this.bridgeSocket = await invoke<string>("bridge_start"); // throws → stays off
      this.remoteAccess = true;
      await this.persist("remoteAccess", true);
      await this.tryStartCompanion(); // may throw AFTER persisting — bridge is up either way
    } else {
      this.remoteAccess = false;
      this.companion = null;
      this.companionMissing = false;
      await invoke("remote_companion_stop").catch(() => {});
      await invoke("bridge_stop").catch(() => {});
      this.bridgeSocket = null;
      await this.persist("remoteAccess", false);
    }
  }

  async setRemoteArgs(v: string) {
    this.remoteArgs = v;
    await this.persist("remoteArgs", v);
    // Apply live: the start command has restart semantics.
    if (this.remoteAccess && this.companion) {
      await this.tryStartCompanion();
    }
  }

  /** Most-recent-first, deduped, capped list of opened workspace folders. */
  async addRecentFolder(path: string) {
    this.recentFolders = [path, ...this.recentFolders.filter((p) => p !== path)].slice(0, 8);
    await this.persist("recentFolders", $state.snapshot(this.recentFolders));
  }

  async setTerminalSide(side: Dock) {
    this.terminalSide = side;
    await this.persist("terminalSide", side);
  }

  toggleTerminalSide() {
    void this.setTerminalSide(this.terminalSide === "bottom" ? "right" : "bottom");
  }

  async setTheme(theme: Theme) {
    this.theme = theme;
    this.apply();
    await this.persist("theme", theme);
  }

  /** True for the dark theme (drives editor/terminal/mermaid colors). */
  get isDark(): boolean {
    return this.theme === "dark";
  }

  toggleTheme() {
    void this.setTheme(this.theme === "dark" ? "light" : "dark");
  }

  async setLastFolder(path: string | null) {
    this.lastFolder = path;
    await this.persist("lastFolder", path);
  }

  async setSession(session: SessionState) {
    this.session = session;
    await this.persist("session", session);
  }

  async setSidebarSide(side: Side) {
    this.sidebarSide = side;
    await this.persist("sidebarSide", side);
  }

  toggleSidebarSide() {
    void this.setSidebarSide(this.sidebarSide === "left" ? "right" : "left");
  }

  async setSidebarVisible(v: boolean) {
    this.sidebarVisible = v;
    await this.persist("sidebarVisible", v);
  }

  toggleSidebar() {
    void this.setSidebarVisible(!this.sidebarVisible);
  }

  async setOutlineVisible(v: boolean) {
    this.outlineVisible = v;
    await this.persist("outlineVisible", v);
  }

  toggleOutline() {
    void this.setOutlineVisible(!this.outlineVisible);
  }

  async setZoom(zoom: number) {
    this.zoom = zoom;
    await this.persist("zoom", zoom);
  }

  async setKeymap(keymap: Record<string, string>) {
    this.keymap = keymap;
    await this.persist("keymap", keymap);
  }

  private async persist(key: string, value: unknown) {
    try {
      await store.set(storeKey(key), value);
      await store.save();
    } catch (e) {
      console.error("Failed to persist setting:", key, e);
    }
  }
}

export const settings = new Settings();
