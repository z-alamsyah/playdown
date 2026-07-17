import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/** CodeMirror port of primer/github-vscode-theme (Dark/Light Default).
 *  Backgrounds stay transparent so the app's theme canvas shows through. */

const darkUI = EditorView.theme(
  {
    "&": { color: "#e6edf3" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#58a6ff" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: "rgba(51, 146, 255, 0.27)" },
    ".cm-activeLine": { backgroundColor: "rgba(110, 118, 129, 0.1)" },
    ".cm-gutters": { color: "#6e7681" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#e6edf3" },
    ".cm-panels": { backgroundColor: "#161b22", color: "#e6edf3" },
  },
  { dark: true },
);

const darkHL = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#8b949e", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.moduleKeyword, t.controlKeyword], color: "#ff7b72" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#a5d6ff" },
  { tag: [t.number, t.bool, t.atom, t.null], color: "#79c0ff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className], color: "#d2a8ff" },
  { tag: [t.variableName, t.attributeName, t.definition(t.variableName)], color: "#ffa657" },
  { tag: t.propertyName, color: "#79c0ff" },
  { tag: [t.typeName, t.tagName], color: "#7ee787" },
  { tag: t.heading, color: "#79c0ff", fontWeight: "700" },
  { tag: [t.link, t.url], color: "#a5d6ff", textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.monospace, color: "#a5d6ff" },
  { tag: [t.contentSeparator, t.quote], color: "#8b949e" },
  { tag: [t.inserted], color: "#7ee787" },
  { tag: [t.deleted], color: "#ffa198" },
]);

const lightUI = EditorView.theme(
  {
    "&": { color: "#1f2328" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0969da" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: "rgba(84, 174, 255, 0.35)" },
    ".cm-activeLine": { backgroundColor: "rgba(234, 238, 242, 0.5)" },
    ".cm-gutters": { color: "#8c959f" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#1f2328" },
    ".cm-panels": { backgroundColor: "#f6f8fa", color: "#1f2328" },
  },
  { dark: false },
);

const lightHL = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#6e7781", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.moduleKeyword, t.controlKeyword], color: "#cf222e" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#0a3069" },
  { tag: [t.number, t.bool, t.atom, t.null], color: "#0550ae" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className], color: "#8250df" },
  { tag: [t.variableName, t.attributeName, t.definition(t.variableName)], color: "#953800" },
  { tag: t.propertyName, color: "#0550ae" },
  { tag: [t.typeName, t.tagName], color: "#116329" },
  { tag: t.heading, color: "#0550ae", fontWeight: "700" },
  { tag: [t.link, t.url], color: "#0a3069", textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.monospace, color: "#0a3069" },
  { tag: [t.contentSeparator, t.quote], color: "#6e7781" },
  { tag: [t.inserted], color: "#116329" },
  { tag: [t.deleted], color: "#82071e" },
]);

export const githubDark: Extension = [darkUI, syntaxHighlighting(darkHL)];
export const githubLight: Extension = [lightUI, syntaxHighlighting(lightHL)];
