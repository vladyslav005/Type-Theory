import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleX, Info, RotateCcw, Undo2} from "lucide-react";
import type {EvaluationResult, ReductionStep, Term, Type} from "@vladyslav005/tt-core";
import {accumulateBindings, EvaluationStrategy, Evaluator} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {ManualParseError, parseTermProgram, termKey} from "@/shared/lib/manualParse.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {BracketInput} from "@/shared/components/BracketInput.tsx";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {TermPickProvider, TermView, TypeAliasesContext, ViewToggle} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";
import {findTermById, firstDifference, markSubterm, termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {NodeFeedback} from "@/features/proof-tree/feedback/NodeFeedback.tsx";
import type {FeedbackMessage} from "@/features/proof-tree/feedback/feedback.ts";
import {setEvaluationPracticeSnapshot} from "@/shared/lib/studentWorkSnapshot.ts";
import {trackPractice} from "@/shared/activity/taskTracking.ts";
import {usePracticeSession} from "@/shared/activity/practiceSession.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";

interface EvaluationPracticeProps {
  evaluation: EvaluationResult;
  typeAliases: Record<string, Type>;
  taskId?: string;
  // Controlled by the panel header when it has one (as in automatic mode); otherwise the toggle sits in the practice bar.
  viewMode?: "single" | "all";
  onViewModeChange?: (mode: "single" | "all") => void;
  // "follow": steps must follow the evaluation's strategy; "any": any single reduction step counts (full normalization).
  strategyMode?: "follow" | "any";
  // How the student's text is read — e.g. NBL syntax in the NBL lab.
  parseInput?: (text: string) => Term | undefined;
}

interface Row {
  text: string;
  term: Term;
}

// What step i starts from: derived from the rows, so editing an earlier step re-judges the later ones.
interface Position {
  before: Term;
  bindings: {name: string; value: Term}[];
  expected?: ReductionStep;
  // Results counted as a correct step: the next step, or the one after skipping name→definition replacements.
  accepted: Term[];
  // Only name→definition replacements are left before a value, so the term already counts as one.
  onlyDefinitionsLeft: boolean;
}

// Replacing a name with its definition isn't a computation step, so a student may skip it.
const isDefinitionStep = (step: ReductionStep) => step.rule === "definition";
const accepts = (position: Position | undefined, term: Term) => !!position && position.accepted.some((option) => termsAlphaEqual(term, option));

type Ending = "value" | "stuck";

const STRATEGIES = [EvaluationStrategy.CALL_BY_VALUE, EvaluationStrategy.CALL_BY_NAME, EvaluationStrategy.NORMAL];
// How far ahead a "you did several steps at once" answer is recognised.
const LOOKAHEAD = 4;
// Enough room for a chain of name→definition replacements before the next real step.
const DEFINITION_LOOKAHEAD = 12;

const message = (code: string, params?: FeedbackMessage["params"]): FeedbackMessage => ({code: `evalPractice.msg.${code}`, params});

const GUIDE_STEPS = ["read", "write", "insert", "check", "finish"];


const defaultParse = (text: string) => parseTermProgram(text).term;

function replaceNode(root: Term, id: string, replacement: Term): Term {
  const walk = (node: unknown): unknown => {
    if (typeof node !== "object" || node === null) return node;
    if (Array.isArray(node)) return node.map(walk);
    if ((node as {id?: unknown}).id === id) return replacement;
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, key === "pos" ? value : walk(value)]));
  };
  return walk(root) as Term;
}

export function EvaluationPractice({evaluation, typeAliases, taskId, viewMode: controlledViewMode, onViewModeChange, strategyMode = "follow", parseInput = defaultParse}: EvaluationPracticeProps) {
  const anyOrder = strategyMode === "any";
  const {t} = useTranslation();
  const {strategy} = evaluation;

  const [rows, setRows] = useSavedState<Row[]>(taskId && `${taskId}#rows`, []);
  // The step being worked on; rows.length means a new step after the last one.
  const [cursor, setCursor] = useSavedState(taskId && `${taskId}#cursor`, 0);
  // Unsaved text per step, so moving around never loses what was typed.
  const [drafts, setDrafts] = useSavedState<Record<number, string>>(taskId && `${taskId}#drafts`, {});
  const [ending, setEnding] = useSavedState<Ending | undefined>(taskId && `${taskId}#ending`, undefined);
  const [ownViewMode, setOwnViewMode] = useState<"single" | "all">("all");
  const viewMode = controlledViewMode ?? ownViewMode;
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([]);
  const [hintOk, setHintOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // cursor is tracked from input events and applied in an effect; refs can't be read during render
  const [selection, setSelection] = useState({start: 0, end: 0});
  const [caretRequest, setCaretRequest] = useState<{position: number; id: number} | undefined>();

  const startTerm: Term = evaluation.steps[0]?.before ?? evaluation.result;
  // Lab tasks are tracked per task; practice in the editor is recorded as its own session with the term.
  const session = usePracticeSession("evaluation", termKey(startTerm), strategyMode === "any" ? "any" : strategy);
  const practiceProps = taskId ? {} : session.activityProps;
  const input = drafts[cursor] ?? rows[cursor]?.text ?? "";
  const setInput = (text: string) => setDrafts((d) => ({...d, [cursor]: text}));
  const history = useUndoableText(input, setInput);

  const traceFrom = useMemo(() => (term: Term, bindings: {name: string; value: Term}[], steps: number, under: EvaluationStrategy = strategy) => {
    const scope = {...evaluation.globals, ...Object.fromEntries(bindings.map((b) => [b.name, b.value]))};
    return new Evaluator(steps).evaluate({
      kind: "Program",
      id: "practice",
      globals: Object.entries(scope).map(([name, value]) => ({kind: "FunDecl" as const, id: `global-${name}`, name, value})),
      term,
    }, under);
  }, [evaluation.globals, strategy]);

  // Every term one reduction step away: each sub-term that is itself a redex, contracted in place.
  const allReducts = useMemo(() => (term: Term, bindings: Position["bindings"]): Term[] => {
    const results: Term[] = [];
    const visit = (node: unknown, bound: Set<string>) => {
      if (typeof node !== "object" || node === null) return;
      if (Array.isArray(node)) return node.forEach((item) => visit(item, bound));
      const candidate = node as Term & {param?: string};
      if (typeof candidate.kind === "string" && typeof candidate.id === "string" && !candidate.kind.startsWith("Ty") && !candidate.kind.endsWith("Type")) {
        const step = traceFrom(candidate, bindings, 1, EvaluationStrategy.NORMAL).steps[0];
        const shadowed = step?.rule === "definition" && candidate.kind === "Var" && bound.has(candidate.name);
        if (step && step.selectedId === candidate.id && !shadowed) results.push(replaceNode(term, candidate.id, step.after));
      }
      const inner = candidate.kind === "Abs" && candidate.param ? new Set(bound).add(candidate.param) : bound;
      Object.entries(node).forEach(([key, value]) => key !== "pos" && visit(value, inner));
    };
    visit(term, new Set());
    return results;
  }, [traceFrom]);

  const positions = useMemo<Position[]>(() => {
    const list: Position[] = [];
    let before = startTerm;
    let bindings: {name: string; value: Term}[] = [];
    for (let i = 0; i <= rows.length; i += 1) {
      const trace = traceFrom(before, bindings, DEFINITION_LOOKAHEAD);
      const ahead = trace.steps;
      const accepted: Term[] = [];
      if (anyOrder) {
        accepted.push(...allReducts(before, bindings));
      } else {
        for (let k = 0; k < ahead.length; k += 1) {
          accepted.push(ahead[k].after);
          if (!isDefinitionStep(ahead[k])) break;
        }
      }
      const onlyDefinitionsLeft = !anyOrder && ahead.length > 0 && ahead.every(isDefinitionStep)
        && !trace.reachedStepLimit && (trace.errors?.length ?? 0) === 0;
      list.push({before, bindings, expected: ahead[0], accepted, onlyDefinitionsLeft});
      if (i < rows.length) {
        const matched = accepted.findIndex((option) => termsAlphaEqual(rows[i].term, option));
        const taken = ahead.slice(0, Math.max(matched, 0) + 1);
        bindings = [...bindings, ...accumulateBindings(taken, taken.length)];
        before = rows[i].term;
      }
    }
    return list;
  }, [rows, startTerm, traceFrom, anyOrder, allReducts]);

  const position = positions[Math.min(cursor, rows.length)];
  const atEnd = cursor >= rows.length;
  const finalPosition = positions[rows.length];
  const actualEnding: Ending | "reducible" = (anyOrder ? finalPosition.accepted.length > 0 : finalPosition.expected)
    ? (finalPosition.onlyDefinitionsLeft ? "value" : "reducible")
    : (traceFrom(finalPosition.before, finalPosition.bindings, 1).errors?.length ?? 0) > 0 ? "stuck" : "value";
  const finished = ending !== undefined;
  const isCorrect = (i: number) => accepts(positions[i], rows[i].term);
  const globals = Object.entries(evaluation.globals ?? {});

  useEffect(() => {
    setEvaluationPracticeSnapshot({
      strategy,
      rows: rows.map((r, i) => ({
        text: r.text,
        correct: accepts(positions[i], r.term),
        correctResult: positions[i].expected ? termKey(positions[i].expected!.after) : null,
      })),
      cursor,
      input,
      ending,
    });
  }, [strategy, rows, positions, cursor, input, ending]);
  useEffect(() => () => setEvaluationPracticeSnapshot(undefined), []);

  useEffect(() => {
    if (!caretRequest) return;
    const el = inputRef.current;
    el?.focus();
    el?.setSelectionRange(caretRequest.position, caretRequest.position);
  }, [caretRequest]);

  const moveTo = (index: number, rowCount = rows.length) => {
    setCursor(Math.max(0, Math.min(index, rowCount)));
    setFeedback([]);
    setHintOk(false);
    setSelection({start: 0, end: 0});
  };

  const read = (text: string): Term | undefined => {
    try {
      return parseInput(text);
    } catch (error) {
      trackPractice(taskId, {type: "unreadable"});
      setHintOk(false);
      setFeedback([message("writeParse", {detail: error instanceof ManualParseError ? error.message : String(error)})]);
      return undefined;
    }
  };

  // Saves this step (new or edited) — wrong steps are allowed and only compared at the end; later steps stay.
  const next = () => {
    const text = input.trim();
    if (!text) return;
    const written = read(text);
    if (!written) return;
    trackPractice(taskId, {type: "step", ok: accepts(position, written)});
    if (!taskId) session.update((entry) => ({...entry, steps: (entry.steps ?? 0) + 1}));
    const updated = [...rows];
    updated[cursor] = {text, term: written};
    setRows(updated);
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== cursor)));
    setEnding(undefined);
    moveTo(cursor + 1, updated.length);
  };

  const diagnose = (written: Term, {before, bindings, expected}: Position): FeedbackMessage => {
    if (!expected) return message("noStepLeft");
    if (termsAlphaEqual(written, before)) return message("nothingChanged");
    if (traceFrom(before, bindings, LOOKAHEAD).steps.slice(1).some((later) => termsAlphaEqual(written, later.after))) return message("tooManySteps");
    if (anyOrder) return message("notOneStep");
    const otherRedex = STRATEGIES.some((other) => {
      if (other === strategy) return false;
      const result = traceFrom(before, bindings, 1, other).steps[0]?.after;
      return result !== undefined && termsAlphaEqual(written, result);
    });
    if (otherRedex) return message("otherRedex", {strategy: `@evalStrategy.${strategy}.label`});
    const difference = firstDifference(written, expected.after);
    return difference ? message("differsAt", {marked: markSubterm(written, difference, termKey)}) : message("differs");
  };

  // Optional hint: says what is wrong with the written step — never what the step should be.
  const check = () => {
    const text = input.trim();
    if (!text) return;
    const written = read(text);
    if (!written) return;
    if (!taskId) session.update((entry) => ({...entry, checks: entry.checks + 1}));
    if (accepts(position, written)) {
      trackPractice(taskId, {type: "check", outcome: "match"});
      setHintOk(true);
      setFeedback([]);
      return;
    }
    trackPractice(taskId, {type: "check", outcome: "mismatch"});
    setHintOk(false);
    setFeedback([diagnose(written, position)]);
  };

  const decide = (claim: Ending) => {
    const allCorrect = rows.every((_, i) => isCorrect(i)) && claim === actualEnding;
    trackPractice(taskId, {type: "completed", allCorrect});
    if (!taskId) session.update((entry) => ({...entry, finished: true, allCorrect}));
    setEnding(claim);
    setFeedback([]);
    setHintOk(false);
  };

  const restart = () => {
    setRows([]);
    setDrafts({});
    setEnding(undefined);
    moveTo(0, 0);
  };

  const insertText = (raw: string) => {
    const start = Math.min(selection.start, input.length);
    const end = Math.min(selection.end, input.length);
    const before = input[start - 1];
    const after = input[end];
    const text = (before !== undefined && !/[\s([{<]/.test(before) ? " " : "")
      + raw
      + (after !== undefined && !/[\s)\]}>,;]/.test(after) ? " " : "");
    const caret = start + text.length;
    history.change(input.slice(0, start) + text + input.slice(end), true);
    setSelection({start: caret, end: caret});
    setCaretRequest((r) => ({position: caret, id: (r?.id ?? 0) + 1}));
    setFeedback([]);
    setHintOk(false);
  };

  const insertFrom = (root: Term) => ({onPick: (id: string) => { const sub = findTermById(root, id); if (sub) insertText(termKey(sub)); }});

  const correctCount = rows.filter((_, i) => isCorrect(i)).length;
  const endingCorrect = ending === actualEnding;

  const verdictMarker = (i: number) => {
    if (!finished) return null;
    return isCorrect(i)
      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t("evalPractice.statusCorrect")}/>
      : <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label={t("evalPractice.statusWrong")}/>;
  };

  const correction = (i: number) => finished && i < rows.length && !isCorrect(i) && (
    <span className="flex gap-2 font-mono text-[11px]">
      <span className="w-14 shrink-0 font-sans text-destructive">{t(anyOrder ? "evalPractice.correctStepExample" : "evalPractice.correctStep")}</span>
      <span className="min-w-0 flex-1 overflow-x-auto">
        {positions[i].expected
          ? <TermView term={positions[i].expected!.after} resultId={positions[i].expected!.resultId}/>
          : <span className="font-sans text-muted-foreground">{t("evalPractice.noStepWasPossible")}</span>}
      </span>
    </span>
  );

  const contextPanel = (position.bindings.length > 0 || globals.length > 0) && (
    <details className="rounded-lg border bg-muted/20 p-2.5 text-xs">
      <summary className="cursor-pointer font-medium uppercase tracking-wide text-muted-foreground">
        {t("evalPractice.context")}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {[...position.bindings.map((b) => ({name: b.name, value: b.value, local: true})), ...globals.map(([name, value]) => ({name, value, local: false}))].map((entry) => (
          <div
            key={`${entry.local ? "b" : "g"}:${entry.name}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono",
              entry.local ? "border-orange-500/20 bg-orange-500/5" : "bg-background/50",
            )}
          >
            <Tip label={t("evalPractice.insertName", {name: entry.name})}>
              <button
                type="button"
                className={cn("font-semibold hover:underline", entry.local && "text-orange-600 dark:text-orange-400")}
                onClick={() => insertText(entry.name)}
              >
                {entry.name}
              </button>
            </Tip>
            <span className="text-muted-foreground">=</span>
            <span className="min-w-0 flex-1 overflow-x-auto">
              <TermPickProvider value={insertFrom(entry.value)}>
                <TermView term={entry.value}/>
              </TermPickProvider>
            </span>
            <Tip label={t("evalPractice.insertDefinition", {name: entry.name})}>
              <Button
                size="sm"
                variant="secondary"
                className="h-6 shrink-0 px-2 text-[11px]"
                onClick={() => insertText(termKey(entry.value))}
              >
                {t("evalPractice.insert")}
              </Button>
            </Tip>
          </div>
        ))}
      </div>
    </details>
  );

  const editor = (
    <div className="rounded-xl border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(atEnd ? "evalPractice.stepNumber" : "evalPractice.editingStep", {current: cursor + 1})}
        </span>
        {cursor > 0 && (
          <Tip label={t("evalPractice.tip.back")}>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => moveTo(cursor - 1)}>
              <Undo2 className="h-3.5 w-3.5"/>
              {t("evalPractice.stepBack")}
            </Button>
          </Tip>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {anyOrder ? t("evalPractice.instructionAny") : t("evalPractice.instruction", {strategy: t(`evalStrategy.${strategy}.label`)})}
      </p>

      <div className="p-3 rounded-lg border font-mono text-sm leading-relaxed overflow-x-auto bg-muted/30">
        <TermPickProvider value={insertFrom(position.before)}>
          <TermView term={position.before}/>
        </TermPickProvider>
      </div>

      <div className="flex flex-col gap-2">
        {contextPanel}
        <BracketInput
          ref={inputRef}
          value={input}
          onChange={(e) => {
            history.change(applyShortcuts(e.target.value));
            setSelection({start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0});
            setFeedback([]);
            setHintOk(false);
          }}
          onSelect={(e) => setSelection({start: e.currentTarget.selectionStart ?? 0, end: e.currentTarget.selectionEnd ?? 0})}
          onKeyDown={(e) => { if (history.onKeyDown(e)) return; if (e.key === "Enter") next(); }}
          placeholder={t("evalPractice.writePlaceholder")}
          spellCheck={false}
          textClassName="px-2 font-mono text-sm"
          className={cn(
            "h-9 rounded border outline-none focus:ring-1 focus:ring-ring",
            hintOk ? "border-emerald-500/70" : feedback.length > 0 ? "border-destructive/70" : "border-input",
          )}
        />
      </div>

      {hintOk
        ? <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3"/>{t("evalPractice.msg.stepCorrect")}</p>
        : <NodeFeedback messages={feedback}/>}
      {correction(cursor)}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {atEnd ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t("evalPractice.noMoreSteps")}</span>
            <Tip label={t(anyOrder ? "evalPractice.tip.normalForm" : "evalPractice.tip.value")}>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => decide("value")}>{t(anyOrder ? "evalPractice.itIsNormalForm" : "evalPractice.itIsValue")}</Button>
            </Tip>
            {!anyOrder && (
              <Tip label={t("evalPractice.tip.stuck")}>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => decide("stuck")}>{t("evalPractice.itIsStuck")}</Button>
              </Tip>
            )}
          </div>
        ) : <span/>}
        <div className="flex items-center gap-2">
          <Tip label={t("evalPractice.tip.check")}>
            <Button size="sm" variant="outline" disabled={!input.trim()} onClick={check}>{t("evalPractice.check")}</Button>
          </Tip>
          <Tip label={t(atEnd ? "evalPractice.tip.next" : "evalPractice.tip.save")}>
            <Button size="sm" className="gap-1" disabled={!input.trim()} onClick={next}>
              {t(atEnd ? "evalPractice.nextStep" : "evalPractice.saveStep")}
              <ArrowRight className="h-3.5 w-3.5"/>
            </Button>
          </Tip>
        </div>
      </div>
    </div>
  );

  const summary = (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
      <p className={cn("flex items-center gap-2 font-medium", endingCorrect && correctCount === rows.length ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
        <Info className="h-4 w-4 shrink-0"/>
        {endingCorrect && correctCount === rows.length ? t("evalPractice.verdictCorrect") : t("evalPractice.verdictWrong")}
      </p>
      <p className="text-xs text-muted-foreground">{t("evalPractice.summary", {correct: correctCount, total: rows.length})}</p>
      <p className="text-xs">
        {t(ending === "value" ? (anyOrder ? "evalPractice.youSaidNormalForm" : "evalPractice.youSaidValue") : "evalPractice.youSaidStuck")}{" "}
        <span className={endingCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
          {endingCorrect ? t("evalPractice.endingCorrect") : t(`evalPractice.ending.${actualEnding}`)}
        </span>
      </p>
      <div className="flex justify-end">
        <Tip label={t("evalPractice.tip.reopen")}>
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setEnding(undefined)}>
            <Undo2 className="h-3.5 w-3.5"/>
            {t("evalPractice.stepBack")}
          </Button>
        </Tip>
      </div>
    </div>
  );

  const showSummary = finished && atEnd;

  return (
    <TypeAliasesContext.Provider value={typeAliases}>
      <div className="w-full h-full flex flex-col gap-4 px-4 pb-4" {...practiceProps}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            {finished ? t("evalPractice.finishedSteps", {count: rows.length}) : t("evalPractice.stepsMade", {count: rows.length})}
          </p>
          <div className="flex items-center gap-1">
            {!onViewModeChange && <ViewToggle mode={viewMode} onChange={setOwnViewMode}/>}
            <GuideDialog i18nPrefix="evalPractice.guide" steps={GUIDE_STEPS}/>
            <Button size="sm" variant="ghost" className="gap-1" onClick={restart}>
              <RotateCcw className="h-3.5 w-3.5"/>
              {t("evalPractice.restart")}
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-2">
          {viewMode === "all" ? (
            <>
              <ol className="space-y-1.5 font-mono text-xs">
                <li className="flex gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                  <span className="w-14 shrink-0 text-muted-foreground">{t("evalPractice.startTerm")}</span>
                  <span className="min-w-0 flex-1 overflow-x-auto"><TermView term={startTerm}/></span>
                </li>
                {rows.map((row, i) => (
                  <li key={i}>
                    <Tip label={t("evalPractice.tip.goTo")} block>
                    <button
                      type="button"
                      onClick={() => moveTo(i)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/40",
                        finished ? (isCorrect(i) ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5") : "bg-muted/20",
                        cursor === i && "ring-2 ring-primary/40",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-14 shrink-0 text-muted-foreground">{i + 1}.</span>
                        <span className="min-w-0 flex-1 overflow-x-auto"><TermView term={row.term}/></span>
                        {verdictMarker(i)}
                      </span>
                      {correction(i)}
                    </button>
                    </Tip>
                  </li>
                ))}
              </ol>
              {showSummary ? summary : editor}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Tip label={t("evalPractice.tip.back")}>
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={cursor === 0} onClick={() => moveTo(cursor - 1)}>
                    <ChevronLeft className="h-4 w-4"/>
                  </Button>
                </Tip>
                <span className="text-xs text-muted-foreground">
                  {atEnd ? (finished ? t("evalPractice.viewingSummary") : t("evalPractice.viewingCurrent")) : t("evalPractice.viewingStep", {current: cursor + 1, total: rows.length})}
                </span>
                <Tip label={t("evalPractice.tip.forward")}>
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={atEnd} onClick={() => moveTo(cursor + 1)}>
                    <ChevronRight className="h-4 w-4"/>
                  </Button>
                </Tip>
              </div>
              {showSummary ? summary : editor}
            </>
          )}
        </div>
      </div>
    </TypeAliasesContext.Provider>
  );
}
