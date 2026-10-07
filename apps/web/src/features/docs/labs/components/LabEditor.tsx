import Editor, {type BeforeMount, type OnMount} from "@monaco-editor/react";
import {useEffect, useImperativeHandle, useRef, useState, type Ref} from "react";
import {useTheme} from "next-themes";
import {useSetUpEditor} from "@/features/editor/hooks/setUpEditor.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {cn} from "@/shared/lib/utils.ts";

const LINE_HEIGHT = 20;
const PADDING = 6;
const MAX_HEIGHT = 16 * LINE_HEIGHT + 2 * PADDING;

let languageReady = false;

// Suggestions are position: fixed, which a transformed ancestor (e.g. a popover) would offset; this layer has none.
function overflowLayer(): HTMLElement {
  const parent = document.fullscreenElement ?? document.body;
  let layer = parent.querySelector<HTMLElement>(":scope > .lab-editor-overflow");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "monaco-editor lab-editor-overflow";
    Object.assign(layer.style, {position: "absolute", top: "0", left: "0", width: "0", height: "0", zIndex: "100"});
    parent.appendChild(layer);
  }
  return layer;
}

export interface LabEditorMarker {
  line: number;
  message: string;
  severity: "error" | "warning";
}

export interface LabEditorHandle {
  // Inserts at the cursor (replacing a selection), padding with spaces so it doesn't glue onto neighbouring tokens.
  insert: (text: string) => void;
  focus: () => void;
}

// A small Monaco editor for lab answers that grows with its content. Ctrl+Enter submits; a compact
// (one-line) editor also submits on Enter, like the plain input it replaces, with Shift+Enter for a new line.
export function LabEditor({value, onChange, onSubmit, placeholder, language = "lambda", compact = false, className = "w-full max-w-xl", handleRef, autoFocus = false, suggestWhileTyping = false, detachWidgets = false, dense = false, minWidth = "100%", onBlur, markers}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  language?: string;
  compact?: boolean;
  className?: string;
  handleRef?: Ref<LabEditorHandle>;
  autoFocus?: boolean;
  suggestWhileTyping?: boolean;
  // Set when the editor sits inside a transformed container such as a popover.
  detachWidgets?: boolean;
  // Matches a small h-7 input, e.g. a field inside a proof tree.
  dense?: boolean;
  minWidth?: string;
  onBlur?: () => void;
  markers?: LabEditorMarker[];
}) {
  const lineHeight = dense ? 16 : LINE_HEIGHT;
  const padding = dense ? 5 : PADDING;
  const minHeight = (compact ? 1 : 3) * lineHeight + 2 * padding;
  const {resolvedTheme} = useTheme();
  const {setUpMonacoLanguage} = useSetUpEditor();
  const [height, setHeight] = useState(minHeight);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);
  const blurRef = useRef(onBlur);
  useEffect(() => { blurRef.current = onBlur; }, [onBlur]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const decorationsRef = useRef<ReturnType<Parameters<OnMount>[0]["createDecorationsCollection"]> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!mounted || !monaco || !model) return;
    const valid = (markers ?? []).filter((marker) => marker.line <= model.getLineCount());
    monaco.editor.setModelMarkers(model, "lab-editor", valid.map((marker) => ({
      startLineNumber: marker.line,
      endLineNumber: marker.line,
      startColumn: 1,
      endColumn: model.getLineMaxColumn(marker.line),
      message: marker.message,
      severity: marker.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    })));
    decorationsRef.current?.set(valid.map((marker) => ({
      range: new monaco.Range(marker.line, 1, marker.line, 1),
      options: {isWholeLine: true, className: marker.severity === "error" ? "lab-editor-line-error" : "lab-editor-line-warning"},
    })));
  }, [markers, value, mounted]);

  useImperativeHandle(handleRef, () => ({
    insert: (raw) => {
      const editor = editorRef.current;
      const model = editor?.getModel();
      const selection = editor?.getSelection();
      if (!editor || !model || !selection) return;
      const text = model.getValue();
      const start = model.getOffsetAt(selection.getStartPosition());
      const end = model.getOffsetAt(selection.getEndPosition());
      const before = text[start - 1];
      const after = text[end];
      const insert = (before !== undefined && !/[\s([{<]/.test(before) ? " " : "")
        + raw
        + (after !== undefined && !/[\s)\]}>,;]/.test(after) ? " " : "");
      editor.executeEdits("insert", [{range: selection, text: insert, forceMoveMarkers: true}]);
      editor.focus();
    },
    focus: () => editorRef.current?.focus(),
  }), []);

  const beforeMount: BeforeMount = (monaco) => {
    if (languageReady) return;
    setUpMonacoLanguage(monaco);
    languageReady = true;
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    decorationsRef.current = editor.createDecorationsCollection();
    setMounted(true);
    if (autoFocus) {
      editor.focus();
      editor.setPosition(editor.getModel()?.getFullModelRange().getEndPosition() ?? {lineNumber: 1, column: 1});
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current?.(), "!suggestWidgetVisible");
    if (compact) {
      editor.addCommand(monaco.KeyCode.Enter, () => submitRef.current?.(), "!suggestWidgetVisible");
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => editor.trigger("keyboard", "type", {text: "\n"}));
    }
    // Picking a suggestion briefly moves focus away, so only a blur that sticks counts.
    editor.onDidBlurEditorWidget(() => setTimeout(() => {
      if (!editor.hasWidgetFocus()) blurRef.current?.();
    }, 150));
    editor.onDidContentSizeChange(({contentHeight}) => setHeight(dense ? minHeight : Math.min(MAX_HEIGHT, Math.max(minHeight, contentHeight))));

    editor.onDidChangeModelContent((e) => {
      if (e.isUndoing || e.isRedoing || e.isFlush) return;
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;
      const text = model.getValue();
      const next = applyShortcuts(text);
      if (next === text) return;
      const cursor = applyShortcuts(text.slice(0, model.getOffsetAt(position))).length;
      queueMicrotask(() => {
        editor.executeEdits("shortcuts", [{range: model.getFullModelRange(), text: next}]);
        editor.setPosition(model.getPositionAt(cursor));
      });
    });
  };

  return (
    <div
      className={cn("overflow-hidden rounded border border-input focus-within:ring-1 focus-within:ring-ring", dense && "font-mono text-xs", className)}
      // A dense field stays one line and widens with its text (monospace, so ch tracks it) instead of wrapping.
      style={dense ? {width: `max(${minWidth}, calc(${value.length + 2}ch + 12px))`} : undefined}
    >
      <Editor
        height={height}
        language={language}
        theme={resolvedTheme === "dark" ? "lambda-theme-dark" : "lambda-theme"}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        beforeMount={beforeMount}
        onMount={onMount}
        loading={null}
        options={{
          placeholder,
          fontSize: dense ? 12 : 13,
          lineHeight,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          minimap: {enabled: false},
          lineNumbers: compact ? "off" : "on",
          lineNumbersMinChars: 2,
          folding: false,
          glyphMargin: false,
          wordWrap: dense ? "off" : "on",
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          // Lets the page keep scrolling when the wheel passes over a short answer.
          scrollbar: {alwaysConsumeMouseWheel: false, vertical: dense ? "hidden" : "auto", horizontal: dense ? "hidden" : "auto"},
          padding: {top: padding, bottom: padding},
          tabFocusMode: compact,
          fixedOverflowWidgets: true,
          ...(detachWidgets && {overflowWidgetsDomNode: overflowLayer()}),
          automaticLayout: true,
          accessibilitySupport: "off",
          quickSuggestions: suggestWhileTyping,
          contextmenu: false,
        }}
      />
    </div>
  );
}
