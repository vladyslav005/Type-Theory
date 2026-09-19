import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowRight, CheckCircle2, CircleAlert, CircleMinus, RotateCcw} from "lucide-react";
import type {EvaluationResult, Term, Type} from "@vladyslav005/tt-core";
import {accumulateBindings} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {ManualParseError, parseTermProgram, termKey} from "@/shared/lib/manualParse.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {BracketInput} from "@/shared/components/BracketInput.tsx";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {TermPickProvider, TermView, TypeAliasesContext} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";
import {findTermById, termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";

interface EvaluationPracticeProps {
  evaluation: EvaluationResult;
  typeAliases: Record<string, Type>;
}

interface Feedback {
  verdict: "valid" | "invalid";
  messages: {code: string; params?: Record<string, string>}[];
}

interface Answer {
  status: "correct" | "wrong" | "skipped";
  text: string;
  checked: boolean;
}

export function EvaluationPractice({evaluation, typeAliases}: EvaluationPracticeProps) {
  const {t} = useTranslation();
  const {steps, result, strategy} = evaluation;
  const total = steps.length;
  const stuck = (evaluation.errors?.length ?? 0) > 0;
  const truncated = evaluation.reachedStepLimit;

  const [stepIndex, setStepIndex] = useState(0);
  const [pickedId, setPickedId] = useState<string | undefined>();
  const [pickVerdict, setPickVerdict] = useState<"valid" | "invalid" | undefined>();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [checkedText, setCheckedText] = useState<string | undefined>();
  const [showAllResults, setShowAllResults] = useState(false);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Feedback | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // cursor is tracked from input events and applied in an effect; refs can't be read during render
  const [selection, setSelection] = useState({start: 0, end: 0});
  const [caretRequest, setCaretRequest] = useState<{position: number; id: number} | undefined>();

  const history = useUndoableText(input, setInput);

  const done = stepIndex >= total;
  const step = done ? undefined : steps[stepIndex];
  const expected = step?.resultId ? findTermById(step.after, step.resultId) : undefined;
  const startTerm: Term = steps[0]?.before ?? result;
  const completed = useMemo(() => steps.slice(0, stepIndex), [steps, stepIndex]);
  const bindings = useMemo(() => accumulateBindings(steps, stepIndex), [steps, stepIndex]);
  const globals = Object.entries(evaluation.globals ?? {});

  const resetStepState = () => {
    setPickedId(undefined);
    setPickVerdict(undefined);
    setInput("");
    setFeedback(undefined);
    setCheckedText(undefined);
    setSelection({start: 0, end: 0});
  };

  const matches = (text: string): "match" | "mismatch" | "unreadable" => {
    try {
      const written = parseTermProgram(text).term;
      if (!written || !step) return "mismatch";
      return (expected && termsAlphaEqual(written, expected)) || termsAlphaEqual(written, step.after) ? "match" : "mismatch";
    } catch {
      return "unreadable";
    }
  };

  const next = () => {
    const text = input.trim();
    const status: Answer["status"] = !text ? "skipped" : matches(text) === "match" ? "correct" : "wrong";
    setAnswers((a) => [...a, {status, text, checked: checkedText !== undefined && checkedText === text}]);
    setStepIndex((i) => i + 1);
    resetStepState();
  };

  const restart = () => {
    setStepIndex(0);
    setAnswers([]);
    setShowAllResults(false);
    resetStepState();
  };

  useEffect(() => {
    if (!caretRequest) return;
    const el = inputRef.current;
    el?.focus();
    el?.setSelectionRange(caretRequest.position, caretRequest.position);
  }, [caretRequest]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({block: "nearest", behavior: "smooth"});
  }, [stepIndex]);

  const select = (id: string, shiftKey: boolean) => {
    if (!step) return;
    if (shiftKey) {
      const sub = findTermById(step.before, id);
      if (sub) insertText(termKey(sub));
      return;
    }
    setPickedId(id);
    setPickVerdict(undefined);
    setFeedback(undefined);
  };

  const askIfRedex = () => {
    if (!step || pickedId === undefined) return;
    if (pickedId === step.selectedId) {
      setPickVerdict("valid");
      setFeedback({verdict: "valid", messages: [{code: "pickCorrect"}]});
    } else {
      setPickVerdict("invalid");
      setFeedback({verdict: "invalid", messages: [{code: "pickWrong"}, {code: `evalPractice.hint.${strategy}`}]});
    }
  };

  const check = () => {
    const outcome = matches(input);
    if (!input.trim()) return;
    setCheckedText(input.trim());
    if (outcome === "match") {
      setFeedback({verdict: "valid", messages: [{code: "correct"}]});
    } else if (outcome === "unreadable") {
      let detail = "";
      try { parseTermProgram(input); } catch (error) { detail = error instanceof ManualParseError ? error.message : String(error); }
      setFeedback({verdict: "invalid", messages: [{code: "writeParse", params: {detail}}]});
    } else {
      setFeedback({verdict: "invalid", messages: [{code: "writeWrong"}]});
    }
  };

  const insertText = (text: string) => {
    const start = Math.min(selection.start, input.length);
    const end = Math.min(selection.end, input.length);
    const position = start + text.length;
    history.change(input.slice(0, start) + text + input.slice(end), true);
    setSelection({start: position, end: position});
    setCaretRequest((r) => ({position, id: (r?.id ?? 0) + 1}));
    setFeedback(undefined);
  };

  const insertFrom = (root: Term) => (!done
    ? {onPick: (id: string) => { const sub = findTermById(root, id); if (sub) insertText(termKey(sub)); }}
    : undefined);
  // hidden until the redex is confirmed, or it would give the pick away
  const redex = step && pickVerdict === "valid" ? findTermById(step.before, step.selectedId) : undefined;
  const selectedTerm = step && pickedId !== undefined ? findTermById(step.before, pickedId) : undefined;
  const visible = (answer: Answer | undefined) => !!answer && (answer.checked || showAllResults);
  const correctCount = answers.filter((a) => a.status === "correct").length;
  const anyVerdictShown = answers.some(visible);

  const progress = total === 0 ? 100 : Math.round((Math.min(stepIndex, total) / total) * 100);

  const marker = (answer: Answer | undefined) => {
    if (!answer || !visible(answer)) return null;
    if (answer.status === "correct") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t("evalPractice.statusCorrect")}/>;
    if (answer.status === "wrong") return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("evalPractice.statusWrong")}/>;
    return <CircleMinus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("evalPractice.statusSkipped")}/>;
  };

  return (
    <TypeAliasesContext.Provider value={typeAliases}>
      <div className="w-full h-full flex flex-col gap-4 px-4 pb-4">
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("evalPractice.stepsDone", {done: Math.min(stepIndex, total), total})}
              {anyVerdictShown && (
                <>
                  {" — "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t("evalPractice.correctCount", {count: answers.filter((a) => visible(a) && a.status === "correct").length})}
                  </span>
                </>
              )}
            </p>
            <Button size="sm" variant="ghost" className="gap-1" onClick={restart}>
              <RotateCcw className="h-3.5 w-3.5"/>
              {t("evalPractice.restart")}
            </Button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-300" style={{width: `${progress}%`}}/>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2">
          <ol className="space-y-1.5 font-mono text-xs">
            <li className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="w-12 shrink-0 text-muted-foreground">{t("evalPractice.startTerm")}</span>
              <span className="min-w-0 flex-1 overflow-x-auto">
                <TermPickProvider value={insertFrom(startTerm)}>
                  <TermView term={startTerm}/>
                </TermPickProvider>
              </span>
            </li>
            {completed.map((s, i) => (
              <li key={i} className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                <span className="w-12 shrink-0 text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 overflow-x-auto">
                  <TermPickProvider value={insertFrom(s.after)}>
                    <TermView term={s.after} resultId={s.resultId}/>
                  </TermPickProvider>
                  {visible(answers[i]) && answers[i].status === "wrong" && (
                    <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-400">
                      {t("evalPractice.youWrote", {text: answers[i].text})}
                    </span>
                  )}
                </span>
                {marker(answers[i])}
              </li>
            ))}
          </ol>

          {done ? (
            <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0"/>
                {stuck ? t("evalPractice.finishedStuck") : truncated ? t("evalPractice.finishedLimit") : t("evalPractice.finishedNormalForm")}
              </div>
              {total > 0 && (showAllResults
                ? <span className="pl-6 text-xs">{t("evalPractice.summary", {correct: correctCount, total})}</span>
                : (
                  <div className="pl-6">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAllResults(true)}>
                      {t("evalPractice.showResults")}
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-xl border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("evalPractice.stepOf", {current: stepIndex + 1, total})}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("evalPractice.instruction", {strategy: t(`evalStrategy.${strategy}.label`)})}
              </p>

              <div className="p-3 rounded-lg border font-mono text-sm leading-relaxed overflow-x-auto bg-muted/30">
                <TermPickProvider value={{pickedId, verdict: pickVerdict, onPick: select}}>
                  <TermView term={step!.before}/>
                </TermPickProvider>
              </div>

              {selectedTerm && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("evalPractice.selected")}</span>
                  <code className="min-w-0 max-w-full truncate rounded bg-background px-1.5 py-0.5 font-mono">{termKey(selectedTerm)}</code>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => insertText(termKey(selectedTerm))}>
                      {t("evalPractice.insertSelection")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={askIfRedex}>
                      {t("evalPractice.isRedex")}
                    </Button>
                    <button
                      type="button"
                      className="px-1 text-muted-foreground hover:text-foreground"
                      title={t("evalPractice.clearSelection")}
                      onClick={() => { setPickedId(undefined); setPickVerdict(undefined); setFeedback(undefined); }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {redex && (
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => insertText(termKey(redex))}>
                      {t("evalPractice.insertRedex")}
                    </Button>
                  )}
                </div>

                {(bindings.length > 0 || globals.length > 0) && (
                  <details open className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                    <summary className="cursor-pointer font-medium uppercase tracking-wide text-muted-foreground">
                      {t("evalPractice.context")}
                    </summary>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {[...bindings.map((b) => ({name: b.name, value: b.value, local: true})), ...globals.map(([name, value]) => ({name, value, local: false}))].map((entry) => (
                        <div
                          key={`${entry.local ? "b" : "g"}:${entry.name}`}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono",
                            entry.local ? "border-orange-500/20 bg-orange-500/5" : "bg-background/50",
                          )}
                        >
                          <button
                            type="button"
                            className={cn("font-semibold hover:underline", entry.local && "text-orange-600 dark:text-orange-400")}
                            title={t("evalPractice.insertName", {name: entry.name})}
                            onClick={() => insertText(entry.name)}
                          >
                            {entry.name}
                          </button>
                          <span className="text-muted-foreground">=</span>
                          <span className="min-w-0 flex-1 overflow-x-auto">
                            <TermPickProvider value={insertFrom(entry.value)}>
                              <TermView term={entry.value}/>
                            </TermPickProvider>
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 shrink-0 px-2 text-[11px]"
                            title={t("evalPractice.insertDefinition", {name: entry.name})}
                            onClick={() => insertText(termKey(entry.value))}
                          >
                            {t("evalPractice.insert")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <BracketInput
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    history.change(applyShortcuts(e.target.value));
                    setSelection({start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0});
                    setFeedback(undefined);
                  }}
                  onSelect={(e) => setSelection({start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0})}
                  onKeyDown={(e) => { if (history.onKeyDown(e)) return; if (e.key === "Enter") check(); }}
                  placeholder={t("evalPractice.writePlaceholder")}
                  spellCheck={false}
                  textClassName="px-2 font-mono text-sm"
                  className={cn(
                    "h-9 rounded border outline-none focus:ring-1 focus:ring-ring",
                    feedback?.verdict === "invalid" ? "border-destructive/70" : feedback?.verdict === "valid" ? "border-emerald-500/70" : "border-input",
                  )}
                />
                <p className="text-xs text-muted-foreground">{t("evalPractice.writeHint")}</p>
              </div>

              {feedback && (
                <ul className={cn("space-y-0.5 text-xs", feedback.verdict === "valid" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                  {feedback.messages.map((m, i) => (
                    <li key={i}>{t(m.code.startsWith("evalPractice.") ? m.code : `evalPractice.msg.${m.code}`, m.params)}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" disabled={!input.trim()} onClick={check}>{t("evalPractice.check")}</Button>
                <Button size="sm" className="gap-1" onClick={next}>
                  {stepIndex + 1 >= total ? t("evalPractice.finish") : t("evalPractice.nextStep")}
                  <ArrowRight className="h-3.5 w-3.5"/>
                </Button>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>
    </TypeAliasesContext.Provider>
  );
}
