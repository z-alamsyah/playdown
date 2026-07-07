import { LazyStore } from "@tauri-apps/plugin-store";

export interface Annotation {
  id: string;
  /** 0-based source line of the annotated block (data-line anchor). */
  line: number;
  /** Quoted text — the selection, or the block's text excerpt. */
  quote: string;
  /** The reviewer's comment. */
  text: string;
  createdAt: number;
}

const store = new LazyStore("annotations.json");

/** Annotate mode for RFC review: annotations per file, persisted app-side
 *  (no files added to the user's repo), exported as an AI-ready prompt. */
class Annotations {
  /** Annotate mode toggle (session-only). */
  enabled = $state(false);
  byFile = $state<Record<string, Annotation[]>>({});

  async load() {
    try {
      const saved = await store.get<Record<string, Annotation[]>>("byFile");
      if (saved) this.byFile = saved;
    } catch (e) {
      console.error("Failed to load annotations:", e);
    }
  }

  listFor(path: string | null | undefined): Annotation[] {
    if (!path) return [];
    return (this.byFile[path] ?? [])
      .slice()
      .sort((a, b) => a.line - b.line || a.createdAt - b.createdAt);
  }

  /** Other files that also have annotations (included in the export). */
  otherFiles(path: string): string[] {
    return Object.keys(this.byFile).filter(
      (p) => p !== path && (this.byFile[p]?.length ?? 0) > 0,
    );
  }

  add(path: string, line: number, quote: string, text: string) {
    const list = this.byFile[path] ?? [];
    this.byFile[path] = [
      ...list,
      { id: crypto.randomUUID(), line, quote, text, createdAt: Date.now() },
    ];
    void this.persist();
  }

  remove(path: string, id: string) {
    const next = (this.byFile[path] ?? []).filter((a) => a.id !== id);
    if (next.length) this.byFile[path] = next;
    else delete this.byFile[path];
    void this.persist();
  }

  clear(path: string) {
    delete this.byFile[path];
    void this.persist();
  }

  /** Build an AI-ready prompt from every file that has annotations. */
  formatPrompt(relativeOf: (p: string) => string): string {
    const files = Object.keys(this.byFile).filter(
      (p) => (this.byFile[p]?.length ?? 0) > 0,
    );
    if (!files.length) return "";
    const parts = [
      "Apply the following review feedback. For each item, locate the quoted text near the given line and revise it according to the comment.",
    ];
    for (const f of files) {
      parts.push(`\n## ${relativeOf(f)}`);
      this.listFor(f).forEach((a, i) => {
        const quote = a.quote.replace(/\s+/g, " ").trim();
        const comment = a.text.trim().replace(/\n/g, "\n   ");
        parts.push(`${i + 1}. Line ${a.line + 1} — "${quote}"\n   ${comment}`);
      });
    }
    return parts.join("\n");
  }

  private async persist() {
    try {
      await store.set("byFile", $state.snapshot(this.byFile));
      await store.save();
    } catch (e) {
      console.error("Failed to persist annotations:", e);
    }
  }
}

export const annotations = new Annotations();
