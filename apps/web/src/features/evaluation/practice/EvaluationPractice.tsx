import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowRight, CheckCircle2, CircleAlert, Eye, Info, RotateCcw} from "lucide-react";
import type {EvaluationResult, ReductionStep, Term, Type} from "@vladyslav005/tt-core";
import {accumulateBindings, Evaluator} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {ManualParseError, parseTermProgram, termKey} from "@/shared/lib/manualParse.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {BracketInput} from "@/shared/components/BracketInput.tsx";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {TermPickProvider, TermView, TypeAliasesContext} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";
import {findTermById, termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {setEvaluationPracticeSnapshot} from "@/shared/lib/studentWorkSnapshot.ts";

interface EvaluationPracticeProps {
  evaluation: EvaluationResult;
  typeAliases: Record<string, Type>;
}

interface Feedback {
  verdict: "valid" | "invalid";
  messages: {code: string; params?: Record<string, string>}[];
}

interface Answer {
  status: "correct" | "wrong";
  text: string;
  term: Term;
  step: ReductionStep;
  revealed: boolean;
}

const evaluator = new Evaluator();

// Γ's local bindings go in as globals: a student may write a name the real trace already substituted away.
const traceFrom = (evaluation: EvaluationResult, term: Term, bindings: {name: string; value: Term}[]): EvaluationResult => {
  const scope = {...evaluation.globals, ...Object.fromEntries(bindings.map((b) => [b.name, b.value]))};
  return evaluator.evaluate({
    kind: "Program",
    id: "practice",
    globals: Object.entries(scope).map(([name, value]) => ({kind: "FunDecl" as const, id: `global-${name}`, name, value})),
    term,
  }, evaluation.strategy);
};

const GUIDE_STEPS = ["read", "write", "insert", "check", "finish"];

export function EvaluationPractice({evaluation, typeAliases}: EvaluationPracticeProps) {
  const {t} = useTranslation();
  const {strategy} = evaluation;

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

  useEffect(() => {
    setEvaluationPracticeSnapshot({
      strategy,
      answers: answers.map((a) => ({text: a.text, status: a.status, revealed: a.revealed, correctResult: termKey(a.step.after)})),
      input,
      checkedText,
    });
  }, [strategy, answers, input, checkedText]);
  useEffect(() => () => setEvaluationPracticeSnapshot(undefined), []);

  const startTerm: Term = evaluation.steps[0]?.before ?? evaluation.result;
  const current = answers.length > 0 ? answers[answers.length - 1].term : startTerm;
  const trace = useMemo(
    () => (answers.length === 0 ? evaluation : traceFrom(evaluation, current, accumulateBindings(answers.map((a) => a.step), answers.length))),
    [evaluation, answers, current],
  );
  const step: ReductionStep | undefined = trace.steps[0];
  const done = !step;
  const stepIndex = answers.length;
  const total = evaluation.steps.length;
  const stuck = (trace.errors?.length ?? 0) > 0;
  const truncated = trace.reachedStepLimit;
  const bindings = useMemo(() => {
    const taken = [...answers.map((a) => a.step), ...(step ? [step] : [])];
    return accumulateBindings(taken, taken.length);
  }, [answers, step]);
  const globals = Object.entries(evaluation.globals ?? {});

  const resetStepState = () => {
    setInput("");
    setFeedback(undefined);
    setCheckedText(undefined);
    setSelection({start: 0, end: 0});
  };

  const matches = (text: string): "match" | "mismatch" | "unreadable" => {
    try {
      const written = parseTermProgram(text).term;
      if (!written || !step) return "mismatch";
      return termsAlphaEqual(written, step.after) ? "match" : "mismatch";
    } catch {
      return "unreadable";
    }
  };

  const readError = (text: string) => {
    try { parseTermProgram(text); } catch (error) { return error instanceof ManualParseError ? error.message : String(error); }
    return "";
  };

  const next = () => {
    const text = input.trim();
    if (!text || !step) return;
    let written: Term | undefined;
    try {
      written = parseTermProgram(text).term;
    } catch {
      setFeedback({verdict: "invalid", messages: [{code: "writeParse", params: {detail: readError(text)}}]});
      return;
    }
    if (!written) return;
    const status: Answer["status"] = termsAlphaEqual(written, step.after) ? "correct" : "wrong";
    setAnswers((a) => [...a, {status, text, term: written, step, revealed: checkedText !== undefined && checkedText === text}]);
    resetStepState();
  };

  const restart = () => {
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
  }, [answers.length]);

  const check = () => {
    const outcome = matches(input);
    if (!input.trim()) return;
    setCheckedText(input.trim());
    if (outcome === "match") {
      setFeedback({verdict: "valid", messages: [{code: "correct"}]});
    } else if (outcome === "unreadable") {
      setFeedback({verdict: "invalid", messages: [{code: "writeParse", params: {detail: readError(input)}}]});
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
  const visible = (answer: Answer | undefined) => !!answer && (answer.revealed || showAllResults);
  const toggleReveal = (index: number) => setAnswers((list) => list.map((a, i) => (i === index ? {...a, revealed: !a.revealed} : a)));

  const progress = total === 0 ? 100 : Math.min(100, Math.round((answers.length / total) * 100));
  const realSteps = evaluation.steps;
  const comparedRows = Math.max(realSteps.length, answers.length);
  const sameAsReal = (i: number) => !!answers[i] && !!realSteps[i] && termsAlphaEqual(answers[i].term, realSteps[i].after);
  const matchedReal = Array.from({length: comparedRows}, (_, i) => sameAsReal(i)).filter(Boolean).length;
  const firstDifference = Array.from({length: comparedRows}, (_, i) => i).find((i) => !sameAsReal(i));

  const allCorrect = firstDifference === undefined;

  const marker = (answer: Answer | undefined) => {
    if (!answer || !visible(answer)) return null;
    if (answer.status === "correct") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t("evalPractice.statusCorrect")}/>;
    return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("evalPractice.statusWrong")}/>;
  };

  return (
    <TypeAliasesContext.Provider value={typeAliases}>
      <div className="w-full h-full flex flex-col gap-4 px-4 pb-4">
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("evalPractice.stepsDone", {done: answers.length, total})}
            </p>
            <div className="flex items-center gap-1">
              <GuideDialog i18nPrefix="evalPractice.guide" steps={GUIDE_STEPS}/>
              <Button size="sm" variant="ghost" className="gap-1" onClick={restart}>
                <RotateCcw className="h-3.5 w-3.5"/>
                {t("evalPractice.restart")}
              </Button>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-orange-500 transition-all duration-300" style={{width: `${progress}%`}}/>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2">
          <ol className="space-y-1.5 font-mono text-xs">
            <li className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="w-14 shrink-0 text-muted-foreground">{t("evalPractice.startTerm")}</span>
              <span className="min-w-0 flex-1 overflow-x-auto">
                <TermPickProvider value={insertFrom(startTerm)}>
                  <TermView term={startTerm}/>
                </TermPickProvider>
              </span>
            </li>
            {answers.map((a, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex gap-2">
                  <span className="w-14 shrink-0 text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 overflow-x-auto">
                    <TermPickProvider value={insertFrom(a.term)}>
                      <TermView term={a.term}/>
                    </TermPickProvider>
                  </span>
                  {marker(a)}
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title={t("evalPractice.revealRow")}
                    aria-label={t("evalPractice.revealRow")}
                    onClick={() => toggleReveal(i)}
                  >
                    <Eye className="h-3.5 w-3.5"/>
                  </button>
                </div>
                {visible(a) && a.status === "wrong" && (
                  <div className="flex gap-2 text-[11px]">
                    <span className="w-14 shrink-0 text-amber-700 dark:text-amber-400">{t("evalPractice.correctResult")}</span>
                    <span className="min-w-0 flex-1 overflow-x-auto">
                      <TermView term={a.step.after} resultId={a.step.resultId}/>
                    </span>
                  </div>
                )}
              </li>
            ))}
            {showAllResults && realSteps.slice(answers.length).map((r, j) => (
              <li key={`missed-${j}`} className="flex gap-2 rounded-lg border border-dashed bg-muted/10 px-3 py-2">
                <span className="w-14 shrink-0 text-muted-foreground">{answers.length + j + 1}.</span>
                <span className="min-w-0 flex-1 overflow-x-auto">
                  <TermView term={r.after} resultId={r.resultId}/>
                </span>
                <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-label={t("evalPractice.statusWrong")}/>
              </li>
            ))}
          </ol>

          {done ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0"/>
                {stuck ? t("evalPractice.finishedStuck") : truncated ? t("evalPractice.finishedLimit") : t("evalPractice.finishedNormalForm")}
              </div>
              {answers.length > 0 && !showAllResults && (
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1" onClick={() => setShowAllResults(true)}>
                    <Eye className="h-3.5 w-3.5"/>
                    {t("evalPractice.showResults")}
                  </Button>
                </div>
              )}
              {answers.length > 0 && showAllResults && (
                <div className="flex flex-col gap-1 rounded-xl border p-3 text-sm">
                  <p className={cn("font-medium", allCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                    {allCorrect ? t("evalPractice.compare.verdictCorrect") : t("evalPractice.compare.verdictWrong")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("evalPractice.compare.summary", {matched: matchedReal, total: realSteps.length})}
                    {firstDifference !== undefined && ` ${t("evalPractice.compare.diverged", {step: firstDifference + 1})}`}
                    {answers.length !== realSteps.length && ` ${t("evalPractice.compare.lengths", {yours: answers.length, real: realSteps.length})}`}
                  </p>
                </div>
              )}
            </>
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
                <TermPickProvider value={insertFrom(step!.before)}>
                  <TermView term={step!.before}/>
                </TermPickProvider>
              </div>

              <div className="flex flex-col gap-2">
                {(bindings.length > 0 || globals.length > 0) && (
                  <details className="rounded-lg border bg-muted/20 p-2.5 text-xs">
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
                    <li key={i}>{t(`evalPractice.msg.${m.code}`, m.params)}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" disabled={!input.trim()} onClick={check}>{t("evalPractice.check")}</Button>
                <Button size="sm" className="gap-1" disabled={!input.trim()} onClick={next}>
                  {trace.steps.length <= 1 ? t("evalPractice.finish") : t("evalPractice.nextStep")}
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
