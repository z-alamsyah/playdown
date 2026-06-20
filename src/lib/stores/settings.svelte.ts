import { LazyStore } from "@tauri-apps/plugin-store";
import type { Theme, ViewMode } from "../types";

const store = new LazyStore("settings.json");

/** Persisted UI preferences: theme, last opened folder, view mode. */
class Settings {
  theme = $state<Theme>("dark");
  viewMode = $state<ViewMode>("edit");
  lastFolder = $state<string | null>(null);
  openTabs = $state<string[]>([]);
  loaded = $state(false);

  async load() {
    try {
      const theme = await store.get<Theme>("theme");
      const lastFolder = await store.get<string>("lastFolder");
      const viewMode = await store.get<ViewMode>("viewMode");
      const openTabs = await store.get<string[]>("openTabs");
      if (theme) this.theme = theme;
      if (lastFolder) this.lastFolder = lastFolder;
      if (viewMode) this.viewMode = viewMode;
      if (openTabs) this.openTabs = openTabs;
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
    this.apply();
    this.loaded = true;
  }

  apply() {
    document.documentElement.dataset.theme = this.theme;
  }

  async setTheme(theme: Theme) {
    this.theme = theme;
    this.apply();
    await this.persist("theme", theme);
  }

  toggleTheme() {
    void this.setTheme(this.theme === "dark" ? "light" : "dark");
  }

  async setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    await this.persist("viewMode", mode);
  }

  toggleView() {
    void this.setViewMode(this.viewMode === "edit" ? "preview" : "edit");
  }

  async setLastFolder(path: string) {
    this.lastFolder = path;
    await this.persist("lastFolder", path);
  }

  async setOpenTabs(paths: string[]) {
    this.openTabs = paths;
    await this.persist("openTabs", paths);
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
