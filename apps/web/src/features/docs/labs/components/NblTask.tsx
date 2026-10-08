import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {
  nblConstants,
  nblDepth,
  nblEvaluate,
  nblSize,
  nblSyntaxDerivation,
  NBL_SYNTAX_RULES,
  parseNbl,
  printNbl,
  type NblTerm,
} from "@vladyslav005/tt-core";
import {AntlrParserAdapter, elaborateNbl, EvaluationStrategy, Evaluator, type Program, type Term} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {EvaluationPractice} from "@/features/evaluation/practice/EvaluationPractice.tsx";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {NBL_LANGUAGE_ID} from "@/features/editor/hooks/setUpEditor.ts";
import {Feedback, Row, SolveArea} from "@/features/docs/labs/components/taskUi.tsx";
import {inputClass, type Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {trackTask, useTaskId, useTrackedVerdict} from "@/shared/activity/taskTracking.ts";
import {AstBuilder} from "@/features/docs/workspace/AstBuilder.tsx";
import {Ast} from "@/features/ast/components/ast/Ast.tsx";
import {SyntaxDerivationTree} from "@/features/proof-tree/components/syntax-builder/SyntaxDerivationTree.tsx";
import {PanZoomCanvas} from "@/features/proof-tree/components/PanZoomCanvas.tsx";
import {goalFromNbl, syntaxProgress, withChoice, type SyntaxChoices, type SyntaxGoal} from "@/features/proof-tree/components/syntax-builder/syntaxGoal.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";
import {FullscreenArea} from "@/shared/components/FullscreenArea.tsx";
import {DEFAULT_EVALUATION_LIMITS} from "@/shared/ui-state/termSlice.ts";

export type NblTaskType = "derivation" | "tree" | "size" | "depth" | "constants" | "evaluate";

// Lets the student decide a term isn't in Term, instead of the task telling them.
function NotATermButton({invalid, onVerdict}: {invalid: boolean; onVerdict: (verdict: Verdict) => void}) {
  const {t} = useTranslation();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onVerdict(invalid
        ? {ok: true, text: t("labWidgets.notATermCorrect")}
        : {ok: false, kind: "claimedNotTerm", text: t("labWidgets.tryAgain")})}
    >
      {t("labWidgets.notATerm")}
    </Button>
  );
}

function useInvalidNote(term: NblTerm | undefined, message: string | undefined) {
  const {t} = useTranslation();
  return term ? undefined : t("labWidgets.notInTerm", {detail: message});
}

function DerivationRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const goal = useMemo(() => goalFromNbl(nblSyntaxDerivation(source)), [source]);
  const [choices, setChoices] = useSavedState<SyntaxChoices>(taskId && `${taskId}#choices`, {});
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const progress = syntaxProgress(goal, choices);

  const choose = (key: string, rule: string | undefined) => {
    setChoices((current) => withChoice(current, key, rule));
    setVerdict(undefined);
  };

  const check = () => {
    if (progress.wrong > 0) return setVerdict({ok: false, kind: "wrongRule", text: t("syntaxBuilder.wrong", {count: progress.wrong})});
    if (!progress.done) return setVerdict({ok: false, kind: "treeIncomplete", text: t("syntaxBuilder.incomplete", {count: Math.max(progress.unchosen, 1)})});
    setVerdict({ok: true, text: t(progress.belongs ? "syntaxBuilder.doneBelongs" : "syntaxBuilder.doneNotBelongs")});
  };

  const outline = (node: SyntaxGoal, depth = 0): string[] => [
    `${"  ".repeat(depth)}${node.text} ∈ Term   ${node.rule ?? `✗ ${t("syntaxBuilder.noRuleShort")}`}`,
    ...(node.rule ? node.children.flatMap((child) => outline(child, depth + 1)) : []),
  ];

  return (
    <Row taskId={taskId} index={index} source={source} solution={<pre className="font-mono overflow-x-auto">{outline(goal).join("\n")}</pre>}>
      <SolveArea taskId={taskId}>
        <FullscreenArea title={source}>
          {({full, button}) => (
            <>
              <PanZoomCanvas className={full ? "min-h-0 flex-1" : "h-64"} compact>
                <SyntaxDerivationTree goal={goal} choices={choices} rules={NBL_SYNTAX_RULES} onChoose={choose} showVerdicts={verdict !== undefined} compact/>
              </PanZoomCanvas>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={check}>{t("labWidgets.check")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setChoices({}); setVerdict(undefined); }}>{t("lectureWidgets.reset")}</Button>
                <span className="ml-auto">{button}</span>
              </div>
              {full && <Feedback verdict={verdict}/>}
            </>
          )}
        </FullscreenArea>
      </SolveArea>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

function NumberRow({id, index, source, metric}: {id?: string; index: number; source: string; metric: "size" | "depth"}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const expected = parsed.ok ? (metric === "size" ? nblSize(parsed.term) : nblDepth(parsed.term)) : undefined;
  const [value, setValue] = useSavedState(taskId && `${taskId}#value`, "");
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const check = () => {
    if (invalid) return setVerdict({ok: false, kind: "notInTerm", text: t("labWidgets.tryAgain")});
    setVerdict(Number(value.trim()) === expected ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.tryAgain")});
  };

  return (
    <Row taskId={taskId} index={index} source={source} solution={invalid ?? String(expected)}>
      <SolveArea taskId={taskId}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={value} onChange={(e) => { setValue(e.target.value); setVerdict(undefined); }} onKeyDown={(e) => e.key === "Enter" && check()} className={inputClass} inputMode="numeric" placeholder="0" spellCheck={false}/>
          <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
          <NotATermButton invalid={!!invalid} onVerdict={setVerdict}/>
        </div>
      </SolveArea>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

const CONSTANTS = ["0", "true", "false"];
const formatSet = (values: Iterable<string>) => `{${[...values].sort((a, b) => CONSTANTS.indexOf(a) - CONSTANTS.indexOf(b)).join(", ")}}`;

function ConstantsRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const expected = parsed.ok ? nblConstants(parsed.term) : undefined;
  const [value, setValue] = useSavedState(taskId && `${taskId}#value`, "");
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);

  const check = () => {
    if (invalid || !expected) return setVerdict({ok: false, kind: "notInTerm", text: t("labWidgets.tryAgain")});
    const items = value.split(/[\s,{}]+/).filter(Boolean);
    const unknown = items.find((item) => !CONSTANTS.includes(item));
    if (unknown) return setVerdict({ok: false, kind: "unknownConstant", text: t("labWidgets.unknownConstant", {name: unknown})});
    const given = new Set(items);
    const same = given.size === expected.size && [...given].every((item) => expected.has(item as "0"));
    setVerdict(same ? {ok: true, text: t("labWidgets.correct")} : {ok: false, text: t("labWidgets.tryAgain")});
  };

  return (
    <Row taskId={taskId} index={index} source={source} solution={invalid ?? formatSet(expected!)}>
      <SolveArea taskId={taskId}>
        <div className="flex flex-wrap items-center gap-2">
          <LabEditor value={value} onChange={(next) => { setValue(next); setVerdict(undefined); }} onSubmit={check} placeholder="{0, true}" language={NBL_LANGUAGE_ID} compact className="w-48"/>
          <Button size="sm" disabled={!value.trim()} onClick={check}>{t("labWidgets.check")}</Button>
          <NotATermButton invalid={!!invalid} onVerdict={setVerdict}/>
        </div>
      </SolveArea>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

const nblParser = new AntlrParserAdapter();
const readNbl = (text: string) => elaborateNbl(nblParser.parseExpression(`${text.trim().replace(/;$/, "")};`)).term;

const AST_NODE_TYPES = ["literal", "ifCondition", "succ", "pred", "iszero"];

function TreeRow({id, index, source}: {id?: string; index: number; source: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);
  const expected = useMemo(() => (parsed.ok ? readNbl(source) : undefined), [parsed, source]);
  // An invalid term still gets the builder; nothing the student builds can match it.
  const unmatchable = useMemo<Term>(() => ({kind: "Var", id: "not-a-term", name: "\u0000"}), []);
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);

  const solutionProgram = useMemo<Program | undefined>(
    () => (expected ? {kind: "Program", id: `solution-${source}`, globals: [], term: expected} : undefined),
    [expected, source],
  );

  return (
    <Row
      taskId={taskId}
      index={index}
      source={source}
      solution={solutionProgram ? (
        <div className="h-64 w-full overflow-hidden rounded-md border bg-background">
          <Ast AST={solutionProgram} termOnly hideControls/>
        </div>
      ) : invalid}
    >
      <SolveArea taskId={taskId}>
        <AstBuilder
          compact
          title={source}
          saveKey={taskId}
          expected={expected ?? unmatchable}
          allowedTypes={AST_NODE_TYPES}
          instructions={t("labWidgets.astInstructions")}
          onCheck={(result) => trackTask(taskId, {
            ok: result.correct,
            kind: result.correct ? undefined : result.wrong > 0 ? "wrongNode" : result.missing > 0 ? "treeIncomplete" : "looseNode",
          })}
        />
      </SolveArea>
      <div className="flex gap-2">
        <NotATermButton invalid={!!invalid} onVerdict={setVerdict}/>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

// The NBL rules (TAPL ch. 3) are deterministic, so steps follow call-by-value exactly.
function EvaluateRow({id, index, source}: {id?: string; index: number; source: string}) {
  const taskId = useTaskId(id, source);
  const parsed = useMemo(() => parseNbl(source), [source]);
  const invalid = useInvalidNote(parsed.ok ? parsed.term : undefined, parsed.ok ? undefined : parsed.message);
  const [verdict, setVerdict] = useTrackedVerdict<Verdict>(taskId);
  const evaluation = useMemo(() => {
    if (!parsed.ok) return undefined;
    const program = elaborateNbl(nblParser.parseExpression(`${source};`));
    return new Evaluator(DEFAULT_EVALUATION_LIMITS.maxSteps, {maximumTermSize: DEFAULT_EVALUATION_LIMITS.maxTermSize}).evaluate(program, EvaluationStrategy.CALL_BY_VALUE);
  }, [parsed, source]);
  const full = parsed.ok ? nblEvaluate(parsed.term) : undefined;
  const {t} = useTranslation();

  return (
    <Row
      taskId={taskId}
      index={index}
      source={source}
      solution={full && parsed.ok ? (
        <ol className="space-y-0.5 font-mono">
          <li>{printNbl(parsed.term)}</li>
          {full.steps.map((step, i) => (
            <li key={i} className="flex gap-3">→ {printNbl(step.term)} <span className="ml-auto italic text-muted-foreground">{step.rule}</span></li>
          ))}
          <li className="pt-1 font-sans text-muted-foreground">
            {full.status === "value" ? t("labWidgets.endedValue", {value: printNbl(full.result)}) : t("labWidgets.endedStuck", {term: printNbl(full.result)})}
          </li>
        </ol>
      ) : invalid}
    >
      {evaluation && (
        <SolveArea taskId={taskId}>
          <div className="rounded-lg border bg-background pt-3">
            <EvaluationPractice key={source} evaluation={evaluation} typeAliases={{}} taskId={taskId} parseInput={readNbl}/>
          </div>
        </SolveArea>
      )}
      <div className="flex gap-2">
        <NotATermButton invalid={!!invalid} onVerdict={setVerdict}/>
      </div>
      <Feedback verdict={verdict}/>
    </Row>
  );
}

export function NblTask({id, type, terms}: {id?: string; type: NblTaskType; terms: string[]}) {
  return (
    <ol className="space-y-3 list-none print:hidden">
      {terms.map((source, index) => {
        switch (type) {
          case "derivation": return <DerivationRow key={index} id={id} index={index} source={source}/>;
          case "size": return <NumberRow key={index} id={id} index={index} source={source} metric="size"/>;
          case "depth": return <NumberRow key={index} id={id} index={index} source={source} metric="depth"/>;
          case "constants": return <ConstantsRow key={index} id={id} index={index} source={source}/>;
          case "tree": return <TreeRow key={index} id={id} index={index} source={source}/>;
          case "evaluate": return <EvaluateRow key={index} id={id} index={index} source={source}/>;
        }
      })}
    </ol>
  );
}
