import {useTranslation} from "react-i18next";
import {DEFAULT_TYPE_THEORY_CONFIG, EvaluationStrategy, Evaluator, SLTLCTypeChecker, typeToString, type Program, type Term} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {Row, SolveArea, TaskActions} from "@/features/docs/labs/components/taskUi.tsx";
import {parseProgram, printTerm} from "@/features/docs/labs/typing/labTyping.ts";
import {trackTask, useTaskId} from "@/shared/activity/taskTracking.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";
import {DEFAULT_EVALUATION_LIMITS} from "@/shared/ui-state/termSlice.ts";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";

const evaluator = new Evaluator(DEFAULT_EVALUATION_LIMITS.maxSteps, {maximumTermSize: DEFAULT_EVALUATION_LIMITS.maxTermSize});
const checker = new SLTLCTypeChecker();

function typeErrors(program: Program): {type?: string; errors: string[]} {
  checker.setTheories({...DEFAULT_TYPE_THEORY_CONFIG});
  const tree = checker.check(program);
  const errors = checker.getErrors().map((error) => error.message);
  return {type: errors.length === 0 ? typeToString(tree.type) : undefined, errors};
}

// The evaluator leaves global names in its result (`k2`), so they are replaced by their values and evaluated again.
function inlineGlobals(term: Term, globals: Record<string, Term>, bound: Set<string> = new Set(), depth = 0): Term {
  const walk = (node: unknown, shadowed: Set<string>): unknown => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map((item) => walk(item, shadowed));
    const value = node as {kind?: string; name?: string; param?: string};
    if (value.kind === "Var" && value.name && globals[value.name] && !shadowed.has(value.name)) {
      return depth < 20 ? inlineGlobals(globals[value.name], globals, new Set(), depth + 1) : node;
    }
    const binder = value.kind === "Abs" ? value.param : value.kind === "Let" ? value.name : undefined;
    const inner = binder ? new Set(shadowed).add(binder) : shadowed;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "value" && value.kind === "Let" ? walk(child, shadowed) : walk(child, inner)]));
  };
  return walk(term, bound) as Term;
}

function evaluateFully(program: Program): Term | undefined {
  try {
    const first = evaluator.evaluate(program, EvaluationStrategy.CALL_BY_VALUE);
    if (first.reachedStepLimit) return undefined;
    const second = evaluator.evaluate({...program, globals: [], term: inlineGlobals(first.result, first.globals)}, EvaluationStrategy.CALL_BY_VALUE);
    return second.reachedStepLimit ? undefined : second.result;
  } catch {
    return undefined;
  }
}

interface TestResult {
  call: string;
  expected: string;
  ok: boolean;
  detail?: string;
}

interface RunResult {
  type: string;
  value?: string;
  tests: TestResult[];
}

// A typed program (type aliases, functions, terms) ending with a term; `tests` call its functions by the names the task gives.
export function ProgramTask({id, tests, solution, starter = ""}: {id?: string; tests: [string, string][]; solution?: string; starter?: string}) {
  const {t} = useTranslation();
  const taskId = useTaskId(id);
  const [value, setValue] = useSavedState(taskId && `${taskId}#value`, starter);
  const [result, setResult] = useSavedState<RunResult | undefined>(taskId && `${taskId}#result`, undefined);
  const [error, setError] = useSavedState<string | undefined>(taskId && `${taskId}#error`, undefined);

  const fail = (kind: string, text: string) => {
    trackTask(taskId, {ok: false, kind});
    setResult(undefined);
    setError(text);
  };

  const runTest = (program: Program, [call, expected]: [string, string]): TestResult => {
    const callTerm = parseProgram(call);
    const wanted = parseProgram(expected);
    if (!callTerm.ok || !wanted.ok || !callTerm.program.term || !wanted.program.term) return {call, expected, ok: false};
    const tested: Program = {...program, term: callTerm.program.term};
    const typed = typeErrors(tested);
    if (typed.errors.length > 0) return {call, expected, ok: false, detail: typed.errors[0]};
    const got = evaluateFully(tested);
    const want = evaluateFully(wanted.program);
    if (!got || !want) return {call, expected, ok: false, detail: t("programTask.diverges")};
    const ok = termsAlphaEqual(got, want);
    return {call, expected, ok, detail: ok ? undefined : t("programTask.got", {value: printTerm(got)})};
  };

  const run = () => {
    const read = parseProgram(value);
    if (!read.ok) return fail("cannotRead", t("labWidgets.cannotRead", {detail: read.message}));
    const {program} = read;
    if (!program.term) return fail("noTerm", t("programTask.noTerm"));
    const typed = typeErrors(program);
    if (!typed.type) return fail("illTyped", t("programTask.illTyped", {detail: typed.errors.join(" ")}));
    const final = evaluateFully(program);
    const outcome = tests.map((test) => runTest(program, test));
    const passed = outcome.filter((r) => r.ok).length;
    trackTask(taskId, {ok: passed === outcome.length, kind: passed === outcome.length ? undefined : "tests", score: `${passed}/${outcome.length}`});
    setError(undefined);
    setResult({type: typed.type, value: final && printTerm(final), tests: outcome});
  };

  const passed = result?.tests.filter((r) => r.ok).length ?? 0;

  return (
    <ul className="list-none print:hidden">
      <Row taskId={taskId} index={0} solution={solution ? <pre className="overflow-x-auto font-mono">{solution}</pre> : undefined}>
        <SolveArea taskId={taskId}>
          <LabEditor value={value} onChange={(next) => { setValue(next); setResult(undefined); setError(undefined); }} onSubmit={run} placeholder={t("programTask.placeholder")}/>
          <p className="text-[11px] text-muted-foreground">{t("programTask.hint")}</p>
          <TaskActions>
            <GuideDialog i18nPrefix="labGuides.program" steps={["declarations", "aliases", "products", "last", "tests"]}/>
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
      </Row>
    </ul>
  );
}
