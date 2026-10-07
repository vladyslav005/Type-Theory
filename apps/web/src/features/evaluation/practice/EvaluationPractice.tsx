import {useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {ArrowDown, ArrowRight, CheckCircle2, CircleX, Eye, EyeOff, Flag, Lightbulb, RotateCcw, Undo2} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {createPortal} from "react-dom";
import type {EvaluationResult, ReductionStep, Term, Type} from "@vladyslav005/tt-core";
import {accumulateBindings, EvaluationStrategy, Evaluator} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {ManualParseError, parseTermProgram, termKey} from "@/shared/lib/manualParse.ts";
import {LabEditor, type LabEditorHandle} from "@/features/docs/labs/components/LabEditor.tsx";
import {TermPickProvider, TermView, TypeAliasesContext} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";
import {findTermById, firstDifference, markSubterm, termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {NodeFeedback} from "@/features/proof-tree/feedback/NodeFeedback.tsx";
import type {FeedbackMessage} from "@/features/proof-tree/feedback/feedback.ts";
import {setEvaluationPracticeSnapshot} from "@/shared/lib/studentWorkSnapshot.ts";
import {trackPractice, trackReveal} from "@/shared/activity/taskTracking.ts";
import {usePracticeSession} from "@/shared/activity/practiceSession.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";

interface EvaluationPracticeProps {
  evaluation: EvaluationResult;
  typeAliases: Record<string, Type>;
  taskId?: string;
  // "follow": steps must follow the evaluation's strategy; "any": any single reduction step counts (full normalization).
  strategyMode?: "follow" | "any";
  // How the student's text is read — e.g. NBL syntax in the NBL lab.
  parseInput?: (text: string) => Term | undefined;
  // Where the step count, guide and restart go when a surrounding panel header has room for them.
  toolbarTarget?: HTMLElement | null;
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

export function EvaluationPractice({evaluation, typeAliases, taskId, strategyMode = "follow", parseInput = defaultParse, toolbarTarget}: EvaluationPracticeProps) {
  const anyOrder = strategyMode === "any";
  const {t} = useTranslation();
  const {strategy} = evaluation;

  const [rows, setRows] = useSavedState<Row[]>(taskId && `${taskId}#rows`, []);
  // The step being worked on; rows.length means a new step after the last one.
  const [cursor, setCursor] = useSavedState(taskId && `${taskId}#cursor`, 0);
  // Unsaved text per step, so moving around never loses what was typed.
  const [drafts, setDrafts] = useSavedState<Record<number, string>>(taskId && `${taskId}#drafts`, {});
  const [ending, setEnding] = useSavedState<Ending | undefined>(taskId && `${taskId}#ending`, undefined);
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([]);
  const [hintOk, setHintOk] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const inputRef = useRef<LabEditorHandle>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const scrollToEditor = () => {
    editorRef.current?.scrollIntoView({block: "nearest", behavior: "smooth"});
  };

  const startTerm: Term = evaluation.steps[0]?.before ?? evaluation.result;
  // Lab tasks are tracked per task; practice in the editor is recorded as its own session with the term.
  const session = usePracticeSession("evaluation", termKey(startTerm), strategyMode === "any" ? "any" : strategy);
  const practiceProps = taskId ? {} : session.activityProps;
  const input = drafts[cursor] ?? rows[cursor]?.text ?? "";
  const setInput = (text: string) => setDrafts((d) => ({...d, [cursor]: text}));

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

  // What each step should have been, continuing from the corrected term after a wrong step rather than from the student's.
  const corrections = useMemo(() => {
    const list: {expected?: ReductionStep; afterMistake: boolean}[] = [];
    if (!finished) return {list, remaining: [] as ReductionStep[]};
    let before = startTerm;
    let bindings: Position["bindings"] = [];
    let afterMistake = false;
    for (let i = 0; i < rows.length; i += 1) {
      const expected = afterMistake ? traceFrom(before, bindings, 1).steps[0] : positions[i].expected;
      list.push({expected, afterMistake});
      if (!afterMistake && accepts(positions[i], rows[i].term)) {
        before = rows[i].term;
        bindings = positions[i + 1].bindings;
      } else if (expected) {
        bindings = [...bindings, ...accumulateBindings([expected], 1)];
        before = expected.after;
        afterMistake = true;
      } else {
        afterMistake = true;
      }
    }
    if (!afterMistake) bindings = positions[rows.length].bindings;
    return {list, remaining: traceFrom(before, bindings, Math.max(evaluation.steps.length, 1)).steps};
  }, [finished, rows, positions, startTerm, traceFrom, evaluation.steps.length]);
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
    scrollToEditor();
  }, [cursor]);

  const moveTo = (index: number, rowCount = rows.length) => {
    setCursor(Math.max(0, Math.min(index, rowCount)));
    setFeedback([]);
    setHintOk(false);
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
    setShowSolution(false);
    setFeedback([]);
    setHintOk(false);
  };

  const restart = () => {
    setRows([]);
    setDrafts({});
    setEnding(undefined);
    setShowSolution(false);
    moveTo(0, 0);
  };

  const insertText = (raw: string) => inputRef.current?.insert(raw);

  const insertFrom = (root: Term) => ({onPick: (id: string) => { const sub = findTermById(root, id); if (sub) insertText(termKey(sub)); }});

  const correctCount = rows.filter((_, i) => isCorrect(i)).length;
  const endingCorrect = ending === actualEnding;

  const verdictMarker = (i: number) => {
    if (!finished) return null;
    return isCorrect(i)
      ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t("evalPractice.statusCorrect")}/>
      : <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label={t("evalPractice.statusWrong")}/>;
  };

  const correction = (i: number) => {
    if (!finished || i >= rows.length || isCorrect(i)) return null;
    const {expected, afterMistake} = corrections.list[i] ?? {expected: positions[i].expected, afterMistake: false};
    return (
      <div className="mt-1.5 w-full rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/5 px-4 py-2.5">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {t(afterMistake ? "evalPractice.correctStepAfterMistake" : anyOrder ? "evalPractice.correctStepExample" : "evalPractice.correctStep")}
        </div>
        <div className="font-mono text-sm leading-relaxed overflow-x-auto">
          {expected
            ? <TermView term={expected.after} resultId={expected.resultId}/>
            : <span className="font-sans text-xs text-muted-foreground">{t("evalPractice.noStepWasPossible")}</span>}
        </div>
      </div>
    );
  };

  const contextPanel = (position.bindings.length > 0 || globals.length > 0) && (
    <details className="rounded-lg border bg-muted/20 p-2.5 text-xs">
      <summary className="cursor-pointer font-medium uppercase tracking-wide text-muted-foreground">
        {t("evalPractice.context")}
      </summary>
      <div className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
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
    <div ref={editorRef} className="rounded-xl border border-orange-500/40 p-3 flex flex-col gap-3 scroll-mb-4">
      <p className="text-sm text-muted-foreground">
        {anyOrder ? t("evalPractice.instructionAny") : t("evalPractice.instruction", {strategy: t(`evalStrategy.${strategy}.label`)})}
      </p>

      <div className="flex flex-col gap-2">
        {contextPanel}
        <LabEditor
          handleRef={inputRef}
          compact
          value={input}
          onChange={(text) => {
            if (text === input) return;
            setInput(text);
            setFeedback([]);
            setHintOk(false);
          }}
          onSubmit={next}
          placeholder={t("evalPractice.writePlaceholder")}
          className={cn(
            "w-full",
            hintOk ? "border-emerald-500/70" : feedback.length > 0 ? "border-destructive/70" : "border-input",
          )}
        />
      </div>

      {hintOk
        ? <p className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3"/>{t("evalPractice.msg.stepCorrect")}</p>
        : <NodeFeedback messages={feedback}/>}
      {correction(cursor)}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {cursor > 0 ? (
          <Tip label={t("evalPractice.tip.back")}>
            <Button size="sm" variant="ghost" className="gap-1 px-2" onClick={() => moveTo(cursor - 1)}>
              <Undo2 className="h-3.5 w-3.5"/>
              {t("evalPractice.stepBack")}
            </Button>
          </Tip>
        ) : <span/>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {atEnd && (
            <>
              <Tip label={t(anyOrder ? "evalPractice.tip.normalForm" : "evalPractice.tip.value")}>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => decide("value")}>
                  <Flag className="h-3.5 w-3.5"/>
                  {t(anyOrder ? "evalPractice.itIsNormalForm" : "evalPractice.itIsValue")}
                </Button>
              </Tip>
              {!anyOrder && (
                <Tip label={t("evalPractice.tip.stuck")}>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => decide("stuck")}>
                    <Flag className="h-3.5 w-3.5"/>
                    {t("evalPractice.itIsStuck")}
                  </Button>
                </Tip>
              )}
            </>
          )}
          <Tip label={t("evalPractice.tip.check")}>
            <Button size="sm" variant="outline" className="gap-1" disabled={!input.trim()} onClick={check}>
              <Lightbulb className="h-3.5 w-3.5"/>
              {t("evalPractice.check")}
            </Button>
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

  const allStepsCorrect = correctCount === rows.length;
  const solution = evaluation.steps;
  const remaining = corrections.remaining;
  const toggleSolution = () => {
    if (!showSolution) trackReveal(taskId);
    setShowSolution(!showSolution);
  };

  const remainingChain = (
    <AnimatePresence initial={false}>
      {showSolution && remaining.map((step, k) => (
        <motion.div
          key={k}
          initial={{opacity: 0, height: 0}}
          animate={{opacity: 1, height: "auto"}}
          exit={{opacity: 0, height: 0}}
          transition={{duration: 0.25, ease: "easeOut", delay: Math.min(k, 10) * 0.04}}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <ArrowDown className="h-3.5 w-3.5 shrink-0"/>
            <span className="font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{rows.length + k + 1}</span>
            <span>{step.rule === "β" ? t("evalSteps.betaReduction") : step.rule === "definition" ? t("evalSteps.definitionReplaced") : step.rule}</span>
          </div>
          <div className="w-full rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/5 px-4 py-3 font-mono text-sm leading-relaxed overflow-x-auto">
            <TermView term={step.after} resultId={step.resultId}/>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );

  const resultLine = (ok: boolean, children: ReactNode) => (
    <p className="flex items-start gap-2 text-sm">
      {ok
        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400"/>
        : <CircleX className="h-4 w-4 shrink-0 mt-0.5 text-destructive"/>}
      <span>{children}</span>
    </p>
  );

  const summary = (
    <div className={cn(
      "flex flex-col gap-3 rounded-xl border p-4",
      endingCorrect && allStepsCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5",
    )}>
      <p className={cn("font-medium", endingCorrect && allStepsCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
        {endingCorrect && allStepsCorrect ? t("evalPractice.verdictCorrect") : t("evalPractice.verdictWrong")}
      </p>
      <div className="flex flex-col gap-1.5">
        {anyOrder ? (
          <>
            {resultLine(allStepsCorrect, t("evalPractice.summary", {correct: correctCount, total: rows.length}))}
            <p className="pl-6 text-xs text-muted-foreground">{t("evalPractice.fullLengthAny", {count: solution.length})}</p>
          </>
        ) : resultLine(allStepsCorrect && endingCorrect, t("evalPractice.summaryOfSolution", {correct: correctCount, total: solution.length, made: rows.length}))}
        {!endingCorrect && resultLine(false, <>
          {t(ending === "value" ? (anyOrder ? "evalPractice.youSaidNormalForm" : "evalPractice.youSaidValue") : "evalPractice.youSaidStuck")}{" "}
          {t(`evalPractice.ending.${actualEnding}`)}
        </>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        {remaining.length > 0 ? (
          <Button size="sm" variant="ghost" className="gap-1" onClick={toggleSolution}>
            {showSolution ? <EyeOff className="h-3.5 w-3.5"/> : <Eye className="h-3.5 w-3.5"/>}
            {showSolution ? t("evalPractice.hideSolution") : t(anyOrder ? "evalPractice.showSolutionAny" : "evalPractice.showSolution", {count: remaining.length})}
          </Button>
        ) : <span/>}
        <Tip label={t("evalPractice.tip.reopen")}>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEnding(undefined); setShowSolution(false); }}>
            <Undo2 className="h-3.5 w-3.5"/>
            {t("evalPractice.reopen")}
          </Button>
        </Tip>
      </div>
    </div>
  );

  const showSummary = finished && atEnd;

  const toolbar = (
    <>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {finished ? t("evalPractice.finishedSteps", {count: rows.length}) : t("evalPractice.stepsMade", {count: rows.length})}
      </span>
      <div className="flex items-center">
        <GuideDialog i18nPrefix="evalPractice.guide" steps={GUIDE_STEPS}/>
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={restart}>
          <RotateCcw className="h-3.5 w-3.5"/>
          {t("evalPractice.restart")}
        </Button>
      </div>
    </>
  );

  // index -1 is the start term; the term right above the editor is the one being reduced, so it is clickable.
  const termBox = (term: Term, index: number) => {
    const reduced = index === cursor - 1;
    const verdict = finished && index >= 0 ? (isCorrect(index) ? "ok" : "wrong") : undefined;
    return (
      <Tip label={!reduced && index >= 0 ? t("evalPractice.tip.goTo") : undefined} block>
        <div
          onClick={!reduced && index >= 0 ? () => moveTo(index) : undefined}
          className={cn(
            "w-full min-w-0 px-4 py-3 rounded-xl border font-mono text-sm leading-relaxed overflow-x-auto transition-colors duration-300",
            verdict === "ok" && "border-emerald-500/30 bg-emerald-500/5",
            verdict === "wrong" && "border-destructive/30 bg-destructive/5",
            !verdict && (reduced ? "bg-muted/40 border-orange-500/40" : "bg-muted/10 text-foreground/70"),
            !reduced && index >= 0 && "cursor-pointer hover:bg-muted/30",
          )}
        >
          {reduced
            ? <TermPickProvider value={insertFrom(position.before)}><TermView term={term}/></TermPickProvider>
            : <TermView term={term}/>}
        </div>
      </Tip>
    );
  };

  const arrow = (i: number) => (
    <button
      type="button"
      onClick={() => moveTo(i)}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/50 transition-colors",
        i === cursor ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <ArrowDown className="h-3.5 w-3.5 shrink-0"/>
      <span className="font-semibold px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400">{i + 1}</span>
      {i < rows.length && verdictMarker(i)}
      {i === cursor && i < rows.length && <span>{t("evalPractice.editingStep", {current: i + 1})}</span>}
    </button>
  );

  return (
    <TypeAliasesContext.Provider value={typeAliases}>
      <div className="w-full h-full flex flex-col gap-1 px-4 pb-4" {...practiceProps}>
        {toolbarTarget
          ? createPortal(toolbar, toolbarTarget)
          : <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{toolbar}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col pb-2 [&>*]:shrink-0">
          {termBox(startTerm, -1)}
          <AnimatePresence initial={false}>
            {Array.from({length: atEnd && !finished ? rows.length + 1 : rows.length}, (_, i) => (
              <motion.div
                key={i}
                initial={i === rows.length ? {opacity: 0, height: 0} : false}
                animate={{opacity: 1, height: "auto"}}
                exit={{opacity: 0, height: 0}}
                transition={{duration: 0.25, ease: "easeOut"}}
                onAnimationComplete={i === cursor ? scrollToEditor : undefined}
                className="overflow-hidden"
              >
                {arrow(i)}
                {i === cursor ? editor : (
                  <>
                    {termBox(rows[i].term, i)}
                    {correction(i)}
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {!atEnd && (
            <Tip label={t("evalPractice.tip.forward")}>
              <button
                type="button"
                onClick={() => moveTo(rows.length)}
                className="mt-1 flex items-center gap-2 self-start rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
              >
                <ArrowDown className="h-3.5 w-3.5"/>
                {t("evalPractice.viewingCurrent")}
              </button>
            </Tip>
          )}
          {showSummary && remainingChain}
          {showSummary && (
            <motion.div ref={editorRef} initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} transition={{duration: 0.25, ease: "easeOut"}} className="scroll-mb-4">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <ArrowDown className="h-3.5 w-3.5 shrink-0"/>
                <Flag className="h-3.5 w-3.5 shrink-0"/>
              </div>
              {summary}
            </motion.div>
          )}
        </div>
      </div>
    </TypeAliasesContext.Provider>
  );
}
