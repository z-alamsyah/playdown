import { LazyStore } from "@tauri-apps/plugin-store";
import type { Theme, Side, TitlebarColor } from "../types";
import type { SessionState } from "./groups.svelte";

const store = new LazyStore("settings.json");

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
  loaded = $state(false);

  async load() {
    try {
      const theme = await store.get<Theme>("theme");
      const lastFolder = await store.get<string>("lastFolder");
      const session = await store.get<SessionState>("session");
      const sidebarSide = await store.get<Side>("sidebarSide");
      const sidebarVisible = await store.get<boolean>("sidebarVisible");
      const outlineVisible = await store.get<boolean>("outlineVisible");
      const zoom = await store.get<number>("zoom");
      const keymap = await store.get<Record<string, string>>("keymap");
      const titlebarColor = await store.get<TitlebarColor>("titlebarColor");
      const terminalHeight = await store.get<number>("terminalHeight");
      const terminalOpen = await store.get<boolean>("terminalOpen");
      if (titlebarColor) this.titlebarColor = titlebarColor;
      if (typeof terminalHeight === "number") this.terminalHeight = terminalHeight;
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

  async setTheme(theme: Theme) {
    this.theme = theme;
    this.apply();
    await this.persist("theme", theme);
  }

  toggleTheme() {
    void this.setTheme(this.theme === "dark" ? "light" : "dark");
  }

  async setLastFolder(path: string) {
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
      await store.set(key, value);
      await store.save();
    } catch (e) {
      console.error("Failed to persist setting:", key, e);
    }
  }
}

export const settings = new Settings();
