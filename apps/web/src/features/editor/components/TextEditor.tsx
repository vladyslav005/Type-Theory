import Editor, {type OnChange, type OnMount, useMonaco} from '@monaco-editor/react';
import {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useSetUpEditor} from "@/features/editor/hooks/setUpEditor.ts";
import {useTheme} from "next-themes";
import {cn} from "@/shared/lib/utils.ts";
import {TypeCheckButton} from "@/features/editor/components/TypeCheckButton.tsx";
import {RunButton} from "@/features/editor/components/RunButton.tsx";
import { AnimatePresence, motion } from "framer-motion";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Card, CardContent, CardHeader} from "@/shared/components/ui/card.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {Maximize2, Minimize2} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setAutoBuild, setFontSize, setTermText} from "@/shared/ui-state/termSlice.ts";
import {EvaluateButton} from "@/features/editor/components/EvaluateButton.tsx";
import {useTermHooks} from "@/shared/hooks/processTermHooks.ts";
import type {SourcePosition} from "@vladyslav005/tt-core";
import {DownloadButton} from "@/features/editor/components/DownloadButton.tsx";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/shared/components/ui/select.tsx";
import {Separator} from "@/shared/components/ui/separator.tsx";

// Auto-build debounce: how long to wait after the last keystroke before parsing —
// short enough to feel immediate, long enough not to re-parse on every keystroke.
const AUTO_BUILD_DEBOUNCE_MS = 400;

const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24];

const NO_OPTIONS: Record<string, any> = {};

const ARROW_REPLACEMENTS: Record<string, string> = {"-": "→", "=": "⇒"};

export interface TextEditorProps {
  defaultValue?: string;
  value?: string; // controlled mode
  language?: string; // default "lambda"
  height?: string | number; // default "90vh"
  onChange?: OnChange;
  onMount?: OnMount;
  readOnly?: boolean;
  className?: string;
  options?: Record<string, any>;
  // Hides the Parse/Evaluate buttons from the editor's own header — used on mobile,
  // where those actions live in a shared sticky bottom bar instead.
  hideActions?: boolean;
}

export interface TextEditorHandle {
  setValue: (text: string) => void;
  getValue: () => string;
  highlightRange: (pos: SourcePosition | null) => void;
}

export const TextEditor = forwardRef<TextEditorHandle, TextEditorProps>(function TextEditor(
  {
    defaultValue = "// Write your lambda expression here a : T; (λ x : T . (x) : T -> T) a;",
    value,
    language = "lambda",
    height = "90vh",
    onChange,
    onMount,
    readOnly = false,
    className,
    options = NO_OPTIONS,
    hideActions = false,
  }: TextEditorProps,
  ref,
) {
  const {t} = useTranslation();
  const monaco = useMonaco();
  const { setUpMonacoLanguage } = useSetUpEditor();
  const { theme: appTheme } = useTheme();
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<any>(null);
  const highlightDecorationsRef = useRef<any>(null);
  const dispatch = useAppDispatch()
  const { parseAndTypeCheck, evaluateTerm } = useTermHooks();
  const errorMarkers = useAppSelector((state) => state.term.errorMarkers);
  const autoBuild = useAppSelector((state) => state.term.autoBuild);
  const termText = useAppSelector((state) => state.term.termText);
  const evaluationStrategy = useAppSelector((state) => state.term.evaluationStrategy);
  // Gate auto-evaluate on `proof`, not `ast` — matches the Evaluate button's own disabled
  // condition, so auto-build doesn't try to evaluate declarations with no final term yet.
  const proof = useAppSelector((state) => state.term.proof);
  const fontSize = useAppSelector((state) => state.term.fontSize);
  const isUntyped = useAppSelector((state) => state.term.enabledTheories.untyped);
  const autoBuildTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const monacoTheme = useMemo(() => {
    if (!appTheme) return "lambda-theme";

    if (appTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return isDark ? "lambda-theme-dark" : "lambda-theme";
    }
    return appTheme === "dark" ? "lambda-theme-dark" : "lambda-theme";
  }, [appTheme]);

  useEffect(() => {
    if (monaco && !isMonacoReady) {
      console.log('Monaco instance loaded - setting up language and themes');
      setUpMonacoLanguage(monaco);
      setIsMonacoReady(true);
    }
  }, [monaco, setUpMonacoLanguage, isMonacoReady]);

  const handleBeforeMount = (monaco: any) => {
    if (!isMonacoReady) {
      console.log('Setting up Monaco language and themes before mount');
      setUpMonacoLanguage(monaco);
      setIsMonacoReady(true);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    highlightDecorationsRef.current = editor.createDecorationsCollection([]);

    console.log('Editor mounted - setting initial theme:', monacoTheme);
    monaco.editor.setTheme(monacoTheme);

    dispatch(setTermText(defaultValue))

    editor.addAction({
      id: 'type-check',
      label: 'Type Check',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
      ],
      precondition: 'editorTextFocus',
      run: () => {
        parseAndTypeCheck();
      }
    });

    editor.onDidChangeModelContent((e) => {
      if (e.isUndoing || e.isRedoing || e.isFlush) return;
      const model = editor.getModel();
      if (!model) return;
      const edits: {range: import("monaco-editor").IRange; text: string}[] = [];
      for (const change of e.changes) {
        if (change.text !== ">" || change.rangeLength !== 0) continue;
        const {startLineNumber: line, startColumn: col} = change.range;
        const before = model.getLineContent(line).slice(0, col - 1);
        const arrow = ARROW_REPLACEMENTS[before.slice(-1)];
        const prefix = before.slice(0, -1);
        if (!arrow || prefix.includes("//") || (prefix.match(/"/g)?.length ?? 0) % 2 === 1) continue;
        edits.push({range: {startLineNumber: line, startColumn: col - 1, endLineNumber: line, endColumn: col + 1}, text: arrow});
      }
      if (edits.length > 0) queueMicrotask(() => editor.executeEdits("arrow-replace", edits));
    });

    if (onMount) {
      onMount(editor, monaco);
    }
  };

  const handleAutoBuildToggle = (checked: boolean) => {
    dispatch(setAutoBuild(checked));
    if (checked) parseAndTypeCheck();
  };

  const handleChange: OnChange = (value, ev) => {
    onChange?.(value, ev);

    if (!autoBuild) return;
    if (autoBuildTimerRef.current) clearTimeout(autoBuildTimerRef.current);
    autoBuildTimerRef.current = setTimeout(() => {
      parseAndTypeCheck(value ?? "");
    }, AUTO_BUILD_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (autoBuildTimerRef.current) clearTimeout(autoBuildTimerRef.current);
    };
  }, []);

  // Auto-build's own parse/type-check just landed a fresh `proof` — evaluate right behind it so
  // the result appears without a manual Evaluate click. Also re-fires when the strategy chevron
  // changes while auto-build is on, since the Evaluate button is disabled in that state.
  useEffect(() => {
    if (!autoBuild || !proof) return;
    evaluateTerm(evaluationStrategy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof, autoBuild, evaluationStrategy]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, "lambda-errors", errorMarkers.map((e) => ({
      startLineNumber: e.line,
      startColumn: e.column + 1,
      endLineNumber: e.line,
      endColumn: e.column + 1 + e.length,
      message: e.message,
      severity: monaco.MarkerSeverity.Error,
    })));
  }, [monaco, errorMarkers]);

  const editorOptions = useMemo(() => ({
    fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    lineNumbers: "on" as const,
    roundedSelection: true,
    scrollBeyondLastLine: false,
    readOnly,
    readOnlyMessage: {value: t("editor.lockedWhileBuilding")},
    fixedOverflowWidgets: true,
    minimap: {
      enabled: true,
    },
    padding: {
      top: 16,
      bottom: 16,
    },
    automaticLayout: true,
    accessibilitySupport: "off" as const,
    ...options,
  }), [readOnly, options, fontSize, t]);

  useImperativeHandle(ref, () => ({
    setValue: (text: string) => {
      const editor = editorRef.current;
      if (editor) {
        editor.setValue(text);
      }
      dispatch(setTermText(text));
    },
    getValue: () => {
      const editor = editorRef.current;
      return editor ? editor.getValue() : (value ?? defaultValue);
    },
    highlightRange: (pos: SourcePosition | null) => {
      const decorations = highlightDecorationsRef.current;
      if (!decorations) return;
      if (!pos) {
        decorations.set([]);
        return;
      }
      decorations.set([{
        range: {
          startLineNumber: pos.line,
          startColumn: pos.column + 1,
          endLineNumber: pos.endLine ?? pos.line,
          endColumn: pos.endColumn !== undefined ? pos.endColumn + 1 : pos.column + 1 + pos.length,
        },
        options: {
          inlineClassName: "proof-hover-highlight",
        },
      }]);
    },
  }), [defaultValue, dispatch, value]);

  return (
    <motion.div
      className={cn(className)}
      initial="initial"
      animate="animate"
      variants={fadeInUp}
    >
      <Card
        className={cn(
          "relative shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col",
          isFullscreen && "fixed inset-0 z-50 m-0 rounded-none border-0 shadow-none max-h-none",
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 flex-nowrap overflow-x-auto min-w-0 flex-1">
              {!hideActions && (
                <AnimatePresence mode="wait" initial={false}>
                  {isUntyped ? (
                    <motion.div
                      key="run-button"
                      initial={{opacity: 0, width: 0}}
                      animate={{opacity: 1, width: "auto"}}
                      exit={{opacity: 0, width: 0}}
                      transition={{duration: 0.25, ease: "easeOut"}}
                      className="flex items-center gap-2 shrink-0 overflow-hidden"
                    >
                      <RunButton />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="two-buttons"
                      initial={{opacity: 0, width: 0}}
                      animate={{opacity: 1, width: "auto"}}
                      exit={{opacity: 0, width: 0}}
                      transition={{duration: 0.25, ease: "easeOut"}}
                      className="flex items-center gap-2 shrink-0 overflow-hidden"
                    >
                      <TypeCheckButton />
                      <EvaluateButton />
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              <TooltipProvider>
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="auto-build"
                          checked={autoBuild}
                          onCheckedChange={handleAutoBuildToggle}
                        />
                        <Label htmlFor="auto-build" className="text-sm text-muted-foreground whitespace-nowrap">
                          {t("editor.autoBuild")}
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t("editor.autoBuildTooltip")}
                    </TooltipContent>
                  </Tooltip>

                  <Separator orientation="vertical" className="h-5" />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="editor-font-size" className="text-sm text-muted-foreground whitespace-nowrap">
                          {t("editor.font")}
                        </Label>
                        <Select
                          value={String(fontSize)}
                          onValueChange={(value) => dispatch(setFontSize(Number(value)))}
                        >
                          <SelectTrigger id="editor-font-size" size="sm" className="w-[5.5rem]" aria-label={t("editor.fontSize")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_SIZES.map((size) => (
                              <SelectItem key={size} value={String(size)}>{size}px</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t("editor.fontSizeTooltip")}</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
            <DownloadButton getText={() => editorRef.current?.getValue() ?? termText ?? ""}/>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? t("fullscreen.exit") : t("fullscreen.enter")}
              aria-label={isFullscreen ? t("fullscreen.exit") : t("fullscreen.enter")}
              className="shrink-0"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn("p-0 flex-1 min-h-0")}>
          <div className={cn(
            "relative h-full  rounded-b-md overflow-hidden border",
            isFullscreen && "rounded-none border-0",
          )}>
            <Editor
              height={isFullscreen ? "100%" : height}
              theme={monacoTheme}
              defaultValue={defaultValue}
              value={value}
              defaultLanguage={language}
              language={language}
              onChange={handleChange}
              beforeMount={handleBeforeMount}
              onMount={handleEditorMount}
              options={editorOptions}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
