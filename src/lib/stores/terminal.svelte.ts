export interface TermSession {
  id: string;
  /** display label, e.g. "zsh" */
  label: string;
}

function uid(): string {
  return crypto.randomUUID();
}

/** Multi-session terminal manager (VSCode-style). PTYs live in Rust;
 *  each session's <TerminalView> owns its xterm + lifecycle. */
class TerminalStore {
  sessions = $state<TermSession[]>([]);
  activeId = $state<string | null>(null);
  shellName = $state("shell");

  get active(): TermSession | null {
    return this.sessions.find((s) => s.id === this.activeId) ?? null;
  }

  create(): string {
    const id = uid();
    this.sessions.push({ id, label: this.shellName });
    this.activeId = id;
    return id;
  }

  setActive(id: string) {
    this.activeId = id;
  }

  /** Remove a session; <TerminalView> unmount kills its PTY. */
  close(id: string) {
    const i = this.sessions.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.sessions.splice(i, 1);
    if (this.activeId === id) {
      this.activeId = this.sessions[Math.max(0, i - 1)]?.id ?? null;
    }
  }

  ensureOne() {
    if (this.sessions.length === 0) this.create();
  }
}

export const terminal = new TerminalStore();
