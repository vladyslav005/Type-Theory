import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {DEFAULT_TYPE_THEORY_CONFIG, EvaluationStrategy, Evaluator, SLTLCTypeChecker, TexMapper, type ProofTree, type Program, type Term} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {PanZoomCanvas} from "@/features/proof-tree/components/PanZoomCanvas.tsx";
import {SyntaxDerivationTree} from "@/features/proof-tree/components/syntax-builder/SyntaxDerivationTree.tsx";
import {expectedChoice, type SyntaxChoices, type SyntaxGoal} from "@/features/proof-tree/components/syntax-builder/syntaxGoal.ts";
import {ProofTreeCanvas} from "@/features/proof-tree/components/ProofTreeCanvas.tsx";
import {ManualNodeView} from "@/features/proof-tree/manual/ManualNodeView.tsx";
import {ManualActionsContext, type ManualActions} from "@/features/proof-tree/manual/manualActions.ts";
import {checkManualTree, manualNodeRules, type ManualResults} from "@/features/proof-tree/manual/manualCheck.ts";
import {contextToText, countManualNodes, createManualNode, findManualNode, removeManualNode, type ManualNode} from "@/shared/ui-state/manualProof.ts";
import {definitionName, parseDefinitions, termKey} from "@/shared/lib/manualParse.ts";
import {JUDGEMENT_LANGUAGE_ID, setJudgementNames} from "@/features/editor/hooks/judgementLanguage.ts";
import {failingDefinitions} from "@/features/proof-tree/manual/definitionUses.ts";
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
import {FullscreenArea} from "@/shared/components/FullscreenArea.tsx";
import {DEFAULT_EVALUATION_LIMITS} from "@/shared/ui-state/termSlice.ts";

export type TypingTaskType = "derivation" | "evaluate";
type Calculus = "nbl" | "stlc";

const evaluator = new Evaluator(DEFAULT_EVALUATION_LIMITS.maxSteps, {maximumTermSize: DEFAULT_EVALUATION_LIMITS.maxTermSize});
const solutionMapper = new TexMapper();

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

interface ManualWork {
  tree: ManualNode;
  definitions: string;
}

const derivationChecker = new SLTLCTypeChecker();

// The core checker's derivation of the term — the answer key the manual tree is checked against.
function coreDerivation(program: Program, calculus: Calculus): ProofTree {
  derivationChecker.setTheories({...DEFAULT_TYPE_THEORY_CONFIG, typedNbl: calculus === "nbl"});
  return derivationChecker.check(program);
}

function solvedChoices(goal: SyntaxGoal, choices: SyntaxChoices = {}): SyntaxChoices {
  choices[goal.key] = expectedChoice(goal);
  goal.children.forEach((child) => solvedChoices(child, choices));
  return choices;
}

function editTree(work: ManualWork, edit: (tree: ManualNode) => void): ManualWork {
  const tree = structuredClone(work.tree);
  edit(tree);
  return {...work, tree};
}

function DerivationRow({id, index, source, context, calculus, listed}: {id?: string; index: number; source: string; context?: string; calculus: Calculus; listed: boolean}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, ...(listed ? [source] : []));
  const {goal, parsed, invalid} = useTypingGoal(source, context, calculus);
  const answer = useMemo(() => (parsed ? coreDerivation(parsed.program, calculus) : undefined), [parsed, calculus]);
  const problem = parsed ? firstProblem(goal) : goal;
  const initialWork = (): ManualWork => ({
    tree: {
      ...createManualNode("judgement", answer ? termKey(answer.term) : splitStated(source).term),
      gamma: context ? "Γ_1" : "∅",
      type: splitStated(source).type,
    },
    definitions: context && answer ? `Γ_1 = ${contextToText(answer.gamma, true)}` : "",
  });
  const [work, setWork] = useSavedState<ManualWork>(taskId && `${taskId}#manual`, initialWork);
  const [results, setResults] = useState<ManualResults>({});
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const definitions = useMemo(() => parseDefinitions(work.definitions), [work.definitions]);
  const failing = failingDefinitions(work.definitions, work.tree, results);
  const definitionMarkers = [
    ...definitions.errors.map((e) => ({line: e.line, severity: "error" as const, message: e.message})),
    ...failing.map((f) => ({line: f.line, severity: "warning" as const, message: t("manualBuilder.definitionAllUsesWrong", {line: f.line, name: f.name})})),
  ];
  // Completions are shared by every judgement editor, so a focused lab task offers its own names.
  const offerNames = () => setJudgementNames([
    ...[...definitions.definitions.contexts.keys()].map((k) => definitionName("Γ", k)),
    ...(answer ? termKey(answer.term).match(/[A-Za-z_]\w*/g) ?? [] : []),
  ]);

  const changed = useCallback((nodeId?: string) => {
    setVerdict(undefined);
    setResults((current) => {
      if (!nodeId) return {};
      const next = {...current};
      delete next[nodeId];
      return next;
    });
  }, [setVerdict]);

  const actions = useMemo<ManualActions>(() => ({
    setField: (nodeId, field, value) => {
      setWork((current) => editTree(current, (tree) => {
        const node = findManualNode(tree, nodeId);
        if (node) node[field] = value;
      }));
      changed(nodeId);
    },
    setConstraintsShown: (nodeId, shown) => {
      setWork((current) => editTree(current, (tree) => {
        const node = findManualNode(tree, nodeId);
        if (node) node.constraintsShown = shown;
      }));
      changed(nodeId);
    },
    addPremise: (parentId, kind) => {
      setWork((current) => editTree(current, (tree) => findManualNode(tree, parentId)?.premises.push(createManualNode(kind))));
      changed(parentId);
    },
    removePremise: (nodeId) => {
      setWork((current) => editTree(current, (tree) => removeManualNode(tree, nodeId)));
      changed();
    },
  }), [setWork, changed]);

  const check = () => {
    if (!answer) return;
    const checked = checkManualTree(work.tree, answer, false, definitions.definitions);
    setResults(checked);
    const wrong = Object.values(checked).filter((result) => Object.values(result).some((value) => value === "invalid")).length;
    const complete = countManualNodes(work.tree) === manualNodeRules(work.tree, answer).expected;
    if (wrong > 0) return setVerdict({ok: false, kind: "wrongNode", text: t("typingLab.manualWrong", {count: wrong})});
    if (problem) return setVerdict({ok: false, kind: "illTypedTree", text: t("typingLab.manualIllTyped")});
    if (!complete) return setVerdict({ok: false, kind: "treeIncomplete", text: t("typingLab.manualIncomplete")});
    setVerdict({ok: true, text: t("typingLab.doneWellTyped")});
  };

  const claimIllTyped = () => setVerdict(problem
    ? {ok: true, text: t(invalid ? "typingLab.doneNotTerm" : "typingLab.doneIllTyped")}
    : {ok: false, kind: "claimedIllTyped", text: t("labWidgets.tryAgain")});

  const reset = () => {
    setWork(initialWork());
    setResults({});
    setVerdict(undefined);
  };

  const texTree = useMemo(() => {
    if (!answer || problem) return undefined;
    solutionMapper.setTypeAliases({});
    solutionMapper.setNblRuleNames(calculus === "nbl");
    return solutionMapper.visit(answer);
  }, [answer, problem, calculus]);

  const solution = invalid ? t("typingLab.solutionNotTerm", {detail: invalid}) : texTree ? (
    <div className="flex h-80 w-full flex-col overflow-hidden rounded-md bg-background">
      <ProofTreeCanvas texTree={texTree} treeKey={`solution-${source}`} exportFilename="typing-derivation.tex"/>
    </div>
  ) : (
    <div className="space-y-2">
      <p>{t("typingLab.solutionIllTyped", {judgement: problem?.judgement ?? ""})}</p>
      <PanZoomCanvas className="pointer-events-none h-72" compact>
        <SyntaxDerivationTree
          goal={goal}
          choices={solvedChoices(goal)}
          rules={calculus === "stlc" ? STLC_TYPING_RULES : NBL_TYPING_RULES}
          onChoose={() => {}}
          showVerdicts={false}
          compact
        />
      </PanZoomCanvas>
    </div>
  );

  return (
    <Row taskId={taskId} index={index} source={listed ? source : undefined} solution={solution}>
      <SolveArea taskId={taskId}>
        <p className="text-xs text-muted-foreground">{t("typingLab.manualHint")}</p>
        {invalid ? (
          <p className="text-xs text-destructive">{t("labWidgets.cannotRead", {detail: invalid})}</p>
        ) : (
          <FullscreenArea title={listed ? source : undefined}>
            {({full, button}) => (
            <>
            {context && (
              <div className="shrink-0 space-y-1">
                <p className="text-xs text-muted-foreground">{t("manualBuilder.definitions")}</p>
                <LabEditor
                  language={JUDGEMENT_LANGUAGE_ID}
                  suggestWhileTyping
                  value={work.definitions}
                  onChange={(next) => { setWork((current) => ({...current, definitions: next})); changed(); }}
                  markers={definitionMarkers}
                  className="w-full bg-background"
                />
                {definitions.errors.map((error, i) => (
                  <p key={i} className="text-[11px] text-destructive">{t("manualBuilder.definitionError", {line: error.line, message: error.message})}</p>
                ))}
                {failing.map((f) => (
                  <p key={`fail-${f.line}`} className="text-[11px] text-amber-700 dark:text-amber-400">{t("manualBuilder.definitionAllUsesWrong", {line: f.line, name: f.name})}</p>
                ))}
              </div>
            )}
            <ManualActionsContext.Provider value={actions}>
              <div className="contents" onFocusCapture={offerNames}>
              <PanZoomCanvas className={full ? "min-h-0 flex-1" : "h-96"} compact>
                <ManualNodeView node={work.tree} results={results} usesConstraints={false}/>
              </PanZoomCanvas>
              </div>
            </ManualActionsContext.Provider>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={check}>{t("labWidgets.check")}</Button>
              <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.reset")}</Button>
              <span className="ml-auto">{button}</span>
            </div>
            {full && <Feedback verdict={verdict}/>}
            </>
            )}
          </FullscreenArea>
        )}
      </SolveArea>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={claimIllTyped}>{t("typingLab.notWellTyped")}</Button>
      </div>
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
