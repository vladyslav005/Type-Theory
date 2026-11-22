import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import type {EvaluationResult, Type} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {Row, SolveArea, TaskActions} from "@/features/docs/labs/components/taskUi.tsx";
import {parseProgram, parseTerm} from "@/features/docs/labs/typing/labTyping.ts";
import {evaluateProgram, hashOf, runProgram, typeErrors, type TestResult} from "@/features/docs/labs/components/programCheck.ts";
import {trackTask, useTaskId} from "@/shared/activity/taskTracking.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";
import {EvaluationPractice} from "@/features/evaluation/practice/EvaluationPractice.tsx";
import {SolutionSteps} from "@/features/docs/labs/components/SolutionSteps.tsx";

// Stored in saved work, so its shape only changes additively.
interface RunResult {
  type: string;
  value?: string;
  tests: {call: string; expected: string; ok: boolean; detail?: string}[];
}

type Topic = "products" | "sums";

interface CallEvaluation {
  call: string;
  evaluation?: EvaluationResult;
  typeAliases: Record<string, Type>;
  error?: string;
}

// Each call evaluated in the program's declarations, in place of its last term.
function evaluateCalls(text: string, calls: string[]): CallEvaluation[] | undefined {
  const read = parseProgram(text);
  if (!read.ok) return undefined;
  return calls.map((call) => {
    const term = parseTerm(call);
    if (!term) return {call, typeAliases: {}};
    const program = {...read.program, term};
    const typed = typeErrors(program);
    if (typed.errors.length > 0) return {call, typeAliases: typed.typeAliases, error: typed.errors[0]};
    try {
      return {call, evaluation: evaluateProgram(program), typeAliases: typed.typeAliases};
    } catch (error) {
      return {call, typeAliases: typed.typeAliases, error: error instanceof Error ? error.message : String(error)};
    }
  });
}

// A typed program (type aliases, functions, terms) ending with a term; `tests` call its functions by the names the task gives.
// `evaluate` lists calls the student then evaluates step by step with their own definitions.
export function ProgramTask({id, tests, solution, starter = "", evaluate, topic = "products"}: {
  id?: string;
  tests: [string, string][];
  solution?: string;
  starter?: string;
  evaluate?: string[];
  topic?: Topic;
}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id);
  const [value, setValue] = useSavedState(taskId && `${taskId}#value`, starter);
  const [result, setResult] = useSavedState<RunResult | undefined>(taskId && `${taskId}#result`, undefined);
  const [error, setError] = useSavedState<string | undefined>(taskId && `${taskId}#error`, undefined);

  const testDetail = (test: TestResult) => {
    switch (test.detail?.code) {
      case "error": return test.detail.message;
      case "diverges": return t("programTask.diverges");
      case "got": return t("programTask.got", {value: test.detail.value});
      default: return undefined;
    }
  };

  const run = () => {
    const outcome = runProgram(value, tests);
    if (!outcome.ok) {
      trackTask(taskId, {ok: false, kind: outcome.kind});
      setResult(undefined);
      setError(outcome.kind === "cannotRead"
        ? t("labWidgets.cannotRead", {detail: outcome.detail})
        : outcome.kind === "noTerm" ? t("programTask.noTerm") : t("programTask.illTyped", {detail: outcome.detail}));
      return;
    }
    const passed = outcome.tests.filter((r) => r.ok).length;
    trackTask(taskId, {ok: passed === outcome.tests.length, kind: passed === outcome.tests.length ? undefined : "tests", score: `${passed}/${outcome.tests.length}`});
    setError(undefined);
    setResult({type: outcome.type, value: outcome.value, tests: outcome.tests.map((test) => ({...test, detail: testDetail(test)}))});
  };

  const passed = result?.tests.filter((r) => r.ok).length ?? 0;
  // Only after every test passes: a finished evaluation counts as solving the task. A stored result always belongs to the current text.
  const allPassed = !!result && passed === result.tests.length;
  const practice = useMemo(() => (allPassed && evaluate?.length ? evaluateCalls(value, evaluate) : undefined), [allPassed, value, evaluate]);

  const solutionView = useMemo(() => {
    if (!solution) return undefined;
    const read = parseProgram(solution);
    const calls = evaluate?.length ? evaluateCalls(solution, evaluate) ?? [] : [];
    const finalRun = !evaluate?.length && read.ok && read.program.term
      ? [{call: "", evaluation: evaluateProgram(read.program), typeAliases: typeErrors(read.program).typeAliases}]
      : [];
    return (
      <div className="space-y-2">
        <pre className="overflow-x-auto font-mono">{solution}</pre>
        {[...calls, ...finalRun].map((item, i) => item.evaluation && (
          <div key={i} className="space-y-1">
            {item.call && <p className="font-mono">{item.call}</p>}
            <SolutionSteps evaluation={item.evaluation} numerals="nbl" showGamma/>
          </div>
        ))}
      </div>
    );
  }, [solution, evaluate]);

  const guideSteps = ["declarations", "aliases", topic, "last", "tests", ...(evaluate?.length ? ["practice"] : [])];

  return (
    <ul className="list-none print:hidden">
      <Row taskId={taskId} index={0} solution={solutionView}>
        <SolveArea taskId={taskId}>
          <LabEditor value={value} onChange={(next) => { setValue(next); setResult(undefined); setError(undefined); }} onSubmit={run} placeholder={t("programTask.placeholder")}/>
          <p className="text-[11px] text-muted-foreground">{t("programTask.hint")}</p>
          <TaskActions>
            <GuideDialog i18nPrefix="labGuides.program" steps={guideSteps}/>
            <Button size="sm" disabled={!value.trim()} onClick={run}>{t("labWidgets.runTests")}</Button>
          </TaskActions>
        </SolveArea>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {result && (
          <div className="space-y-1.5">
            <p className="font-mono text-xs">
              <span className="text-muted-foreground">{t("programTask.finalTerm")}</span> : {result.type}
              {result.value ? <> →* {result.value}</> : <span className="text-amber-700 dark:text-amber-400"> — {t("programTask.diverges")}</span>}
            </p>
            {result.tests.length > 0 && (
              <>
                <p className={cn("text-xs font-medium", passed === result.tests.length ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  {t("labWidgets.testsPassed", {passed, total: result.tests.length})}
                </p>
                <ul className="space-y-0.5 font-mono text-xs">
                  {result.tests.map((test, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={test.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{test.ok ? "✓" : "✗"}</span>
                      <span className="min-w-0 break-words">
                        {test.call} →* {test.expected}
                        {test.detail && <span className="block font-sans text-muted-foreground">{test.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {practice?.map((item, i) => (
          <div key={item.call} className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t("programTask.evaluateCall")} <span className="font-mono text-foreground">{item.call}</span></p>
            {item.error && <p className="text-xs text-destructive">{t("programTask.illTyped", {detail: item.error})}</p>}
            {item.evaluation && (
              <div className="rounded-lg border bg-background pt-3">
                <EvaluationPractice
                  key={hashOf(`${value}\n${item.call}`)}
                  evaluation={item.evaluation}
                  typeAliases={item.typeAliases}
                  taskId={taskId && `${taskId}/eval-${i}/${hashOf(`${value}\n${item.call}`)}`}
                  parseInput={parseTerm}
                />
              </div>
            )}
          </div>
        ))}
      </Row>
    </ul>
  );
}
