import { LazyStore } from "@tauri-apps/plugin-store";
import type { Theme } from "../types";
import type { SessionState } from "./groups.svelte";

const store = new LazyStore("settings.json");

/** Persisted preferences: theme, last folder, and the editor session. */
class Settings {
  theme = $state<Theme>("dark");
  lastFolder = $state<string | null>(null);
  session = $state<SessionState | null>(null);
  loaded = $state(false);

  async load() {
    try {
      const theme = await store.get<Theme>("theme");
      const lastFolder = await store.get<string>("lastFolder");
      const session = await store.get<SessionState>("session");
      if (theme) this.theme = theme;
      if (lastFolder) this.lastFolder = lastFolder;
      if (session) this.session = session;
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

  async setLastFolder(path: string) {
    this.lastFolder = path;
    await this.persist("lastFolder", path);
  }

  async setSession(session: SessionState) {
    this.session = session;
    await this.persist("session", session);
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
