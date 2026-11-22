import Editor, {type BeforeMount, type OnMount} from "@monaco-editor/react";
import {useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref} from "react";
import {useTheme} from "next-themes";
import {useTranslation} from "react-i18next";
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
export function LabEditor({value, onChange, onSubmit, placeholder, language = "lambda", compact = false, className = "w-full max-w-xl", handleRef, autoFocus = false, suggestWhileTyping = false, detachWidgets = false, dense = false, minWidth = "100%", onBlur, markers, readOnly = false}: {
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
  readOnly?: boolean;
}) {
  const lineHeight = dense ? 16 : LINE_HEIGHT;
  const padding = dense ? 5 : PADDING;
  const minHeight = (compact ? 1 : 3) * lineHeight + 2 * padding;
  const {t} = useTranslation();
  const {resolvedTheme} = useTheme();
  const {setUpMonacoLanguage} = useSetUpEditor();
  const [height, setHeight] = useState(minHeight);
  // Set once the student drags the corner; auto-growing stops until a double-click resets it.
  const [manualSize, setManualSize] = useState<{width: number; height: number} | undefined>();
  const resizable = !compact && !dense;
  const boxRef = useRef<HTMLDivElement>(null);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (!box) return;
    event.preventDefault();
    const start = {x: event.clientX, y: event.clientY, width: box.offsetWidth, height: manualSize?.height ?? height};
    const maxWidth = box.parentElement?.clientWidth ?? Infinity;
    const move = (e: PointerEvent) => setManualSize({
      width: Math.min(maxWidth, Math.max(160, start.width + e.clientX - start.x)),
      height: Math.max(minHeight, start.height + e.clientY - start.y),
    });
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
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
    // Not editor.addCommand: its keybindings are global, so a compact editor's Enter would swallow Enter in every other editor on the page.
    editor.onKeyDown((e) => {
      if (e.keyCode !== monaco.KeyCode.Enter || e.altKey) return;
      const suggestVisible = (editor as any)._contextKeyService?.getContextKeyValue?.("suggestWidgetVisible") === true;
      if (suggestVisible) return;
      const submit = e.ctrlKey || e.metaKey || (compact && !e.shiftKey);
      if (!submit && !(compact && e.shiftKey)) return;
      e.preventDefault();
      e.stopPropagation();
      if (submit) submitRef.current?.();
      else editor.trigger("keyboard", "type", {text: "\n"});
    });
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
      ref={boxRef}
      className={cn("relative overflow-hidden rounded border border-input focus-within:ring-1 focus-within:ring-ring", dense && "font-mono text-xs", className)}
      // A dense field stays one line and widens with its text (monospace, so ch tracks it) instead of wrapping.
      style={dense ? {width: `max(${minWidth}, calc(${value.length + 2}ch + 12px))`} : manualSize ? {width: manualSize.width, maxWidth: "100%"} : undefined}
    >
      <Editor
        height={manualSize?.height ?? height}
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
          readOnly,
          domReadOnly: readOnly,
        }}
      />
      {resizable && (
        <div
          role="separator"
          aria-label={t("labWidgets.resizeEditor")}
          title={t("labWidgets.resizeEditorTip")}
          onPointerDown={startResize}
          onDoubleClick={() => setManualSize(undefined)}
          className="absolute bottom-0 right-0 z-10 h-3.5 w-3.5 cursor-nwse-resize touch-none text-muted-foreground/60 hover:text-foreground"
        >
          <svg viewBox="0 0 10 10" className="h-full w-full" aria-hidden>
            <path d="M9 3 3 9M9 6 6 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}
