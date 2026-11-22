import {DEFAULT_TYPE_THEORY_CONFIG, EvaluationStrategy, Evaluator, SLTLCTypeChecker, typeToString, type EvaluationResult, type Program, type Term, type Type} from "@vladyslav005/tt-core";
import {termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {parseProgram, printTerm} from "@/features/docs/labs/typing/labTyping.ts";
import {DEFAULT_EVALUATION_LIMITS} from "@/shared/ui-state/termSlice.ts";

const evaluator = new Evaluator(DEFAULT_EVALUATION_LIMITS.maxSteps, {maximumTermSize: DEFAULT_EVALUATION_LIMITS.maxTermSize});
const checker = new SLTLCTypeChecker();

export function typeErrors(program: Program): {type?: string; errors: string[]; typeAliases: Record<string, Type>} {
  checker.setTheories({...DEFAULT_TYPE_THEORY_CONFIG});
  const tree = checker.check(program);
  const errors = checker.getErrors().map((error) => error.message);
  return {type: errors.length === 0 ? typeToString(tree.type) : undefined, errors, typeAliases: checker.getTypeAliases()};
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

// `succ 5` and `6` are the same value; values are compared with numerals collapsed.
function collapseNumerals(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(collapseNumerals);
  const mapped = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, collapseNumerals(child)])) as {kind?: string; term?: {kind?: string; value?: string}};
  if (mapped.kind === "Succ" && mapped.term?.kind === "Lit" && /^\d+$/.test(mapped.term.value ?? "")) {
    return {...mapped.term, value: String(Number(mapped.term.value) + 1)};
  }
  return mapped;
}

export const evaluateProgram = (program: Program): EvaluationResult => evaluator.evaluate(program, EvaluationStrategy.CALL_BY_VALUE);

export function evaluateFully(program: Program): Term | undefined {
  try {
    const first = evaluateProgram(program);
    if (first.reachedStepLimit) return undefined;
    const second = evaluator.evaluate({...program, globals: [], term: inlineGlobals(first.result, first.globals)}, EvaluationStrategy.CALL_BY_VALUE);
    return second.reachedStepLimit ? undefined : collapseNumerals(second.result) as Term;
  } catch {
    return undefined;
  }
}

export interface TestResult {
  call: string;
  expected: string;
  ok: boolean;
  detail?: {code: "error"; message: string} | {code: "diverges"} | {code: "got"; value: string};
}

export function runTest(program: Program, [call, expected]: [string, string]): TestResult {
  const callTerm = parseProgram(call);
  const wanted = parseProgram(expected);
  if (!callTerm.ok || !wanted.ok || !callTerm.program.term || !wanted.program.term) return {call, expected, ok: false};
  const tested: Program = {...program, term: callTerm.program.term};
  const typed = typeErrors(tested);
  if (typed.errors.length > 0) return {call, expected, ok: false, detail: {code: "error", message: typed.errors[0]}};
  const got = evaluateFully(tested);
  const want = evaluateFully(wanted.program);
  if (!got || !want) return {call, expected, ok: false, detail: {code: "diverges"}};
  const ok = termsAlphaEqual(got, want);
  return {call, expected, ok, detail: ok ? undefined : {code: "got", value: printTerm(got)}};
}

export type ProgramRun =
  | {ok: false; kind: "cannotRead" | "noTerm" | "illTyped"; detail: string}
  | {ok: true; program: Program; type: string; value?: string; tests: TestResult[]; typeAliases: Record<string, Type>};

export function runProgram(text: string, tests: [string, string][]): ProgramRun {
  const read = parseProgram(text);
  if (!read.ok) return {ok: false, kind: "cannotRead", detail: read.message};
  const {program} = read;
  if (!program.term) return {ok: false, kind: "noTerm", detail: ""};
  const typed = typeErrors(program);
  if (!typed.type) return {ok: false, kind: "illTyped", detail: typed.errors.join(" ")};
  const final = evaluateFully(program);
  return {ok: true, program, type: typed.type, value: final && printTerm(final), tests: tests.map((test) => runTest(program, test)), typeAliases: typed.typeAliases};
}

// Keeps saved practice steps apart per program without storing the student's text in the task id.
export const hashOf = (text: string) => {
  let hash = 5381;
  for (const char of text.replace(/\s+/g, " ").trim()) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
};
