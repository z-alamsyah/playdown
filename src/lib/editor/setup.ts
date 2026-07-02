import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { search, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { frontmatterExtension } from "./frontmatter";

/** Swappable theme so dark/light can change without rebuilding the editor. */
export const themeCompartment = new Compartment();

/** Holds the markdown extension so code-fence grammars (language-data) can be
 *  swapped in lazily after the editor mounts, keeping that ~200KB off the
 *  cold-start bundle. */
const mdCompartment = new Compartment();

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "var(--mono)", overflow: "auto", lineHeight: "1.6" },
  ".cm-content": { padding: "16px 0", caretColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none", color: "var(--text-faint)" },
  "&.cm-focused": { outline: "none" },
});

export type EditorLanguage = "markdown" | "json" | "text";

export interface EditorOptions {
  parent: HTMLElement;
  doc: string;
  dark: boolean;
  language: EditorLanguage;
  onChange: (value: string) => void;
  onSave: () => void;
}

function languageExtensions(language: EditorLanguage): Extension {
  if (language === "json") return json();
  if (language === "text") return [];
  return [
    mdCompartment.of(markdown({ base: markdownLanguage })),
    frontmatterExtension,
  ];
}

export function createEditor(opts: EditorOptions): EditorView {
  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged) opts.onChange(u.state.doc.toString());
  });

  const appKeymap = keymap.of([
    {
      key: "Mod-s",
      preventDefault: true,
      run: () => {
        opts.onSave();
        return true;
      },
    },
  ]);

  const state = EditorState.create({
    doc: opts.doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      foldGutter(),
      history(),
      drawSelection(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      languageExtensions(opts.language),
      EditorView.lineWrapping,
      search({ top: true }),
      appKeymap,
      keymap.of([
        // ⌘G / Ctrl+G is our "go to line"; drop CodeMirror's find-next on it.
        ...searchKeymap.filter((b) => b.key !== "Mod-g"),
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      updateListener,
      baseTheme,
      themeCompartment.of(opts.dark ? oneDark : []),
    ],
  });

  const view = new EditorView({ state, parent: opts.parent });

  // Lazy-load code-fence language grammars (language-data ~200KB) and wire
  // them into the live editor once ready — off the cold-start path.
  if (opts.language === "markdown") {
    void import("@codemirror/language-data").then(({ languages }) => {
      try {
        view.dispatch({
          effects: mdCompartment.reconfigure(
            markdown({ base: markdownLanguage, codeLanguages: languages }),
          ),
        });
      } catch {
        /* view destroyed before grammars finished loading */
      }
    });
  }

  return view;
}
