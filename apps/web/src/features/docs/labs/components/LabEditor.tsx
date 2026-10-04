import Editor, {type BeforeMount, type OnMount} from "@monaco-editor/react";
import {useEffect, useRef, useState} from "react";
import {useTheme} from "next-themes";
import {useSetUpEditor} from "@/features/editor/hooks/setUpEditor.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {cn} from "@/shared/lib/utils.ts";

const LINE_HEIGHT = 20;
const PADDING = 6;
const MAX_HEIGHT = 16 * LINE_HEIGHT + 2 * PADDING;

let languageReady = false;

// A small Monaco editor for lab answers that grows with its content. Ctrl+Enter submits; a compact
// (one-line) editor also submits on Enter, like the plain input it replaces, with Shift+Enter for a new line.
export function LabEditor({value, onChange, onSubmit, placeholder, language = "lambda", compact = false, className = "w-full max-w-xl"}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  language?: string;
  compact?: boolean;
  className?: string;
}) {
  const minHeight = (compact ? 1 : 3) * LINE_HEIGHT + 2 * PADDING;
  const {resolvedTheme} = useTheme();
  const {setUpMonacoLanguage} = useSetUpEditor();
  const [height, setHeight] = useState(minHeight);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);

  const beforeMount: BeforeMount = (monaco) => {
    if (languageReady) return;
    setUpMonacoLanguage(monaco);
    languageReady = true;
  };

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current?.());
    if (compact) {
      editor.addCommand(monaco.KeyCode.Enter, () => submitRef.current?.());
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => editor.trigger("keyboard", "type", {text: "\n"}));
    }
    editor.onDidContentSizeChange(({contentHeight}) => setHeight(Math.min(MAX_HEIGHT, Math.max(minHeight, contentHeight))));

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
    <div className={cn("overflow-hidden rounded border border-input focus-within:ring-1 focus-within:ring-ring", className)}>
      <Editor
        height={height}
        language={language}
        theme={resolvedTheme === "dark" ? "lambda-theme-dark" : "lambda-theme"}
        value={value}
        onChange={(next) => onChange(next ?? "")}
        beforeMount={beforeMount}
        onMount={onMount}
        options={{
          placeholder,
          fontSize: 13,
          lineHeight: LINE_HEIGHT,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
          minimap: {enabled: false},
          lineNumbers: compact ? "off" : "on",
          lineNumbersMinChars: 2,
          folding: false,
          glyphMargin: false,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          // Lets the page keep scrolling when the wheel passes over a short answer.
          scrollbar: {alwaysConsumeMouseWheel: false, vertical: "auto"},
          padding: {top: PADDING, bottom: PADDING},
          fixedOverflowWidgets: true,
          automaticLayout: true,
          accessibilitySupport: "off",
          quickSuggestions: false,
          contextmenu: false,
        }}
      />
    </div>
  );
}
