import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {EvaluationStrategy, Evaluator, type Program, type Term} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {PanZoomCanvas} from "@/features/proof-tree/components/PanZoomCanvas.tsx";
import {SyntaxDerivationTree} from "@/features/proof-tree/components/syntax-builder/SyntaxDerivationTree.tsx";
import {syntaxProgress, withChoice, type SyntaxChoices, type SyntaxGoal} from "@/features/proof-tree/components/syntax-builder/syntaxGoal.ts";
import {EvaluationPractice} from "@/features/evaluation/practice/EvaluationPractice.tsx";
import {termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {Feedback, Row, SolveArea} from "@/features/docs/labs/components/taskUi.tsx";
import type {Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {
  contextOf,
  firstProblem,
  NBL_TYPING_RULES,
  parseProgram,
  parseTerm,
  printTerm,
  readTypingTerm,
  STLC_TYPING_RULES,
  synthesize,
  typingGoal,
  type TypingProblem,
} from "@/features/docs/labs/typing/labTyping.ts";
import {trackTask, useTaskId, useTrackedVerdict} from "@/shared/activity/taskTracking.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";

export type TypingTaskType = "derivation" | "evaluate";
type Calculus = "nbl" | "stlc";

const evaluator = new Evaluator(500, {maximumTermSize: 5000, timeLimitMs: 1000});

// `term : Type` — the stated type follows the last " : ", since types never contain one.
const splitStated = (source: string) => {
  const at = source.lastIndexOf(" : ");
  return at < 0 ? {term: source, type: ""} : {term: source.slice(0, at), type: source.slice(at + 3)};
};

function useProblemText() {
  const {t} = useTranslation();
  return (problem: TypingProblem) => t(`typingLab.problem.${problem.code}`, problem.params ?? {});
}

function useTypingGoal(source: string, context: string | undefined, calculus: Calculus) {
  return useMemo(() => {
    const parsed = readTypingTerm(source, context);
    if (parsed.ok) return {goal: typingGoal(parsed.value, calculus === "stlc"), parsed: parsed.value, invalid: undefined};
    // Not even a term: shown as a judgement no rule can derive.
    const {term, type} = splitStated(source);
    const goal: SyntaxGoal = {key: "r", judgement: `${calculus === "stlc" ? "∅ " : ""}⊢ ${term} : ${type}`, children: []};
    return {goal, parsed: undefined, invalid: parsed.message};
  }, [source, context, calculus]);
}

function outline(goal: SyntaxGoal, noRule: string, depth = 0): string[] {
  return [
    `${"  ".repeat(depth)}${goal.judgement}   ${goal.rule ?? `✗ ${noRule}`}`,
    ...(goal.rule ? goal.children.flatMap((child) => outline(child, noRule, depth + 1)) : []),
  ];
}

function DerivationRow({id, index, source, context, calculus, listed}: {id?: string; index: number; source: string; context?: string; calculus: Calculus; listed: boolean}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, ...(listed ? [source] : []));
  const {goal, invalid} = useTypingGoal(source, context, calculus);
  const [choices, setChoices] = useSavedState<SyntaxChoices>(taskId && `${taskId}#choices`, {});
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const progress = syntaxProgress(goal, choices);

  const choose = (key: string, rule: string | undefined) => {
    setChoices((current) => withChoice(current, key, rule));
    setVerdict(undefined);
  };

  const check = () => {
    if (progress.wrong > 0) return setVerdict({ok: false, kind: "wrongRule", text: t("typingLab.wrong", {count: progress.wrong})});
    if (!progress.done) return setVerdict({ok: false, kind: "treeIncomplete", text: t("syntaxBuilder.incomplete", {count: Math.max(progress.unchosen, 1)})});
    setVerdict({ok: true, text: t(invalid ? "typingLab.doneNotTerm" : progress.belongs ? "typingLab.doneWellTyped" : "typingLab.doneIllTyped")});
  };

  const solution = invalid
    ? t("typingLab.solutionNotTerm", {detail: invalid})
    : <pre className="font-mono overflow-x-auto">{outline(goal, t("syntaxBuilder.noRuleShort")).join("\n")}</pre>;

  return (
    <Row taskId={taskId} index={index} source={listed ? source : undefined} solution={solution}>
      <SolveArea taskId={taskId}>
        <p className="text-xs text-muted-foreground">{t("typingLab.hint")}</p>
        <PanZoomCanvas className="h-72" compact>
          <SyntaxDerivationTree
            goal={goal}
            choices={choices}
            rules={calculus === "stlc" ? STLC_TYPING_RULES : NBL_TYPING_RULES}
            onChoose={choose}
            showVerdicts={verdict !== undefined}
            compact
          />
        </PanZoomCanvas>
        <div className="flex gap-2">
          <Button size="sm" onClick={check}>{t("labWidgets.check")}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setChoices({}); setVerdict(undefined); }}>{t("lectureWidgets.reset")}</Button>
        </div>
      </SolveArea>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

const arity = (term: Term): number => (term.kind === "Abs" ? 1 + arity(term.body) : 0);

const spine = (term: Term): {head: Term; args: Term[]} => {
  const args: Term[] = [];
  let head = term;
  while (head.kind === "App") {
    args.unshift(head.arg);
    head = head.func;
  }
  return {head, args};
};

// Keeps the practice's saved steps apart for each set of arguments without storing the student's text in the task id.
const hashOf = (text: string) => {
  let hash = 5381;
  for (const char of text.replace(/\s+/g, " ").trim()) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
};

const evaluate = (program: Program) => evaluator.evaluate(program, EvaluationStrategy.CALL_BY_VALUE);

function EvaluateRow({id, source, context, example}: {id?: string; source: string; context?: string; example?: string}) {
  const {t} = useTranslation();
  const problemText = useProblemText();
  const taskId = useTaskId(id);
  const {goal, parsed} = useTypingGoal(source, context, "stlc");
  const problem = parsed ? firstProblem(goal) : goal;
  const {term: termText} = splitStated(source);
  const starter = `${context ? `${context.replace(/;?\s*$/, ";")}\n` : ""}(${termText}) `;
  const [value, setValue] = useSavedState(taskId && `${taskId}#value`, starter);
  const [applied, setApplied] = useSavedState<string | undefined>(taskId && `${taskId}#applied`, undefined);
  const [error, setError] = useSavedState<string | undefined>(taskId && `${taskId}#error`, undefined);
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);

  const appliedProgram = useMemo(() => {
    const read = applied ? parseProgram(applied) : undefined;
    return read?.ok ? read.program : undefined;
  }, [applied]);
  const evaluation = useMemo(() => (appliedProgram ? evaluate(appliedProgram) : undefined), [appliedProgram]);

  const fail = (kind: string, text: string) => {
    trackTask(taskId, {ok: false, kind});
    setError(text);
  };

  // A successful application is not tracked as solved: the evaluation practice records that.
  const apply = () => {
    if (!parsed) return fail("illTypedApplied", t("typingLab.cannotApplyNotTerm"));
    const read = parseProgram(value);
    if (!read.ok) return fail("cannotRead", t("labWidgets.cannotRead", {detail: read.message}));
    const {program} = read;
    const call = program.term ? spine(program.term) : undefined;
    const count = arity(parsed.term);
    if (!call || !termsAlphaEqual(call.head, parsed.term) || call.args.length !== count) {
      return fail("notApplied", t("typingLab.notApplied", {count, term: printTerm(parsed.term)}));
    }
    const context = contextOf(program);
    if (!context.ok) return fail("illTypedApplied", t("typingLab.illTyped", {detail: problemText(context.problem)}));
    const typed = synthesize(program.term!, context.context);
    if (!typed.ok) return fail("illTypedApplied", t("typingLab.illTyped", {detail: problemText(typed.problem)}));
    setError(undefined);
    setApplied(value);
  };

  const claimIllTyped = () => setVerdict(problem
    ? {ok: true, text: t("typingLab.notWellTypedCorrect")}
    : {ok: false, kind: "claimedIllTyped", text: t("labWidgets.tryAgain")});

  const solution = problem ? (
    <p>{parsed ? t("typingLab.solutionIllTyped", {judgement: problem.judgement}) : t("typingLab.solutionNotTerm", {detail: ""})}</p>
  ) : example ? (() => {
    const read = parseProgram(example);
    const result = read.ok ? evaluate(read.program) : undefined;
    return (
      <div className="space-y-1">
        <pre className="font-mono overflow-x-auto">{example}</pre>
        {result && <p className="font-mono">→* {printTerm(result.result)}</p>}
      </div>
    );
  })() : undefined;

  return (
    <Row taskId={taskId} index={0} solution={solution}>
      <SolveArea taskId={taskId}>
        <p className="text-xs text-muted-foreground">{t("typingLab.applyHint")}</p>
        <div className="flex flex-wrap items-start gap-2">
          <LabEditor value={value} onChange={(next) => { setValue(next); setError(undefined); }} onSubmit={apply}/>
          <Button size="sm" disabled={!value.trim()} onClick={apply}>{t("typingLab.apply")}</Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {evaluation && applied && (
          <div className="rounded-lg border bg-background pt-3">
            <EvaluationPractice key={hashOf(applied)} evaluation={evaluation} typeAliases={{}} taskId={taskId && `${taskId}/${hashOf(applied)}`} parseInput={parseTerm}/>
          </div>
        )}
      </SolveArea>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={claimIllTyped}>{t("typingLab.notWellTyped")}</Button>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

// `terms` lists `term : Type` strings (one item each); `term` is a single task, optionally typed in `context`.
export function TypingTask({id, type, terms, term, context, calculus = "nbl", example}: {
  id?: string;
  type: TypingTaskType;
  terms?: string[];
  term?: string;
  context?: string;
  calculus?: Calculus;
  example?: string;
}) {
  if (type === "evaluate" && term) {
    return <ul className="list-none print:hidden"><EvaluateRow id={id} source={term} context={context} example={example}/></ul>;
  }
  const sources = terms ?? (term ? [term] : []);
  return (
    <ol className="space-y-3 list-none print:hidden">
      {sources.map((source, index) => (
        <DerivationRow key={index} id={id} index={index} source={source} context={context} calculus={calculus} listed={!!terms}/>
      ))}
    </ol>
  );
}
