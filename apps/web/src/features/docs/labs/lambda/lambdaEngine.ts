import {
  AntlrParserAdapter,
  Evaluator,
  EvaluationStrategy,
  ParseSyntaxError,
  type EvaluationResult,
  type Program,
  type Term,
} from "@vladyslav005/tt-core";
import {PRELUDE_CODE} from "@/features/editor/components/InsertPreludeButton.tsx";
import {termsAlphaEqual} from "@/features/evaluation/practice/termCompare.ts";
import {termKey} from "@/shared/lib/manualParse.ts";

const parser = new AntlrParserAdapter();
// Recursive fixx-based definitions (lab 3) need far more than the default 500 steps
// even for tiny inputs — pred's pair-shifting trick alone is O(n) reduction steps.
// Correct lab solutions peak around 500 nodes and 30 ms; wrong ones can grow exponentially.
const evaluator = new Evaluator(5000, {maximumTermSize: 5000, timeLimitMs: 1000});

type Parsed = {ok: true; program: Program; term: Term} | {ok: false; message: string};

function messageOf(error: unknown): string {
  if (error instanceof ParseSyntaxError) return error.errors[0]?.message ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

const churchNumeral = (n: number) => `(λ s . λ z . ${"s (".repeat(n)}z${")".repeat(n)})`;

// The labs write Church booleans and numerals as true/false/0,1,2…; the prelude names them tru/fls/zero…
export function labNotation(text: string): string {
  return text
    .replace(/\btrue\b/g, "tru")
    .replace(/\bfalse\b/g, "fls")
    .replace(/\b\d+\b/g, (digits) => churchNumeral(Number(digits)));
}

const PRELUDE_NAMES = parser.parseExpression(PRELUDE_CODE).globals.map((declaration) => declaration.name);
const PRELUDE_GLOBALS = PRELUDE_NAMES.length;

export function parseLambda(text: string, withPrelude = false): Parsed {
  const source = text.trim().replace(/[;\s]+$/, "");
  if (!source) return {ok: false, message: "nothing written here"};
  try {
    const program = parser.parseExpression(`${withPrelude ? `${PRELUDE_CODE}\n` : ""}${source};`);
    if (!program.term) return {ok: false, message: "not a term"};
    if (program.globals.length > (withPrelude ? PRELUDE_GLOBALS : 0)) return {ok: false, message: "write a single term, without your own definitions"};
    return {ok: true, program, term: program.term};
  } catch (error) {
    return {ok: false, message: messageOf(error)};
  }
}

export type AnswerProblem =
  | {kind: "cannotRead"; detail: string}
  | {kind: "redefined" | "recursiveDefinition" | "forbidden"; names: string[]};

export type Answer = {ok: true; program: Program; term: Term} | {ok: false; problem: AnswerProblem};

// A define-task answer: the student's own helper definitions followed by the term under test.
// Helpers may only use the prelude and helpers above them, so recursion still has to go through fixx.
export function parseAnswer(text: string, forbid: string[] = []): Answer {
  const source = labNotation(text).trim().replace(/[;\s]+$/, "");
  if (!source) return {ok: false, problem: {kind: "cannotRead", detail: "nothing written here"}};
  let program: Program;
  try {
    program = parser.parseExpression(`${PRELUDE_CODE}\n${source};`);
  } catch (error) {
    return {ok: false, problem: {kind: "cannotRead", detail: messageOf(error)}};
  }
  if (!program.term) return {ok: false, problem: {kind: "cannotRead", detail: "the last line must be the term to test"}};

  const own = program.globals.slice(PRELUDE_GLOBALS).filter((declaration) => declaration.kind === "FunDecl" || declaration.kind === "VarDecl");
  const names = own.map((declaration) => declaration.name);
  const redefined = names.filter((name, i) => PRELUDE_NAMES.includes(name) || names.indexOf(name) !== i);
  if (redefined.length > 0) return {ok: false, problem: {kind: "redefined", names: [...new Set(redefined)]}};

  const recursive = own.filter((declaration, i) => [...freeVariables(declaration.value)].some((name) => names.indexOf(name) >= i));
  if (recursive.length > 0) return {ok: false, problem: {kind: "recursiveDefinition", names: recursive.map((declaration) => declaration.name)}};

  const used = new Set([...own.flatMap((declaration) => [...freeVariables(declaration.value)]), ...freeVariables(program.term)]);
  const forbidden = forbid.filter((name) => used.has(name));
  if (forbidden.length > 0) return {ok: false, problem: {kind: "forbidden", names: forbidden}};

  return {ok: true, program, term: program.term};
}

// A bare prelude name is a value (`one`), but applied it unfolds (`succ 2` still reduces).
export function isNormalForm(program: Program, term: Term): boolean {
  const definitions = new Map<string, Term>();
  for (const declaration of program.globals) {
    if (declaration.kind === "FunDecl" || declaration.kind === "VarDecl") definitions.set(declaration.name, declaration.value);
  }
  const unfolding = new Set<string>();
  const check = (node: Term, bound: Set<string>): boolean => {
    switch (node.kind) {
      case "Var": {
        const definition = definitions.get(node.name);
        if (bound.has(node.name) || !definition || unfolding.has(node.name) || PRELUDE_NAMES.includes(node.name)) return true;
        unfolding.add(node.name);
        const normal = check(definition, new Set());
        unfolding.delete(node.name);
        return normal;
      }
      case "Abs":
        return check(node.body, new Set([...bound, node.param]));
      case "App":
        return !startsWithAbs(node.func, bound) && check(node.func, bound) && check(node.arg, bound);
      default:
        return true;
    }
  };
  const startsWithAbs = (node: Term, bound: Set<string>): boolean => {
    if (node.kind === "Abs") return true;
    if (node.kind !== "Var" || bound.has(node.name)) return false;
    const definition = definitions.get(node.name);
    return !!definition && !unfolding.has(node.name) && startsWithAbs(definition, new Set());
  };
  return check(term, new Set());
}

// Replaces the head of an application spine (`f a b`) with the given function.
export function withHead(term: Term, head: Term): Term {
  return term.kind === "App" ? {...term, func: withHead(term.func, head)} : head;
}

export interface Normalized {
  result: Term;
  evaluation: EvaluationResult;
  limit: boolean;
}

export function normalize(program: Program): Normalized {
  const evaluation = evaluator.evaluate(program, EvaluationStrategy.NORMAL);
  return {result: evaluation.result, evaluation, limit: evaluation.reachedStepLimit};
}

export function freeVariables(term: Term): Set<string> {
  switch (term.kind) {
    case "Var":
      return new Set([term.name]);
    case "Abs": {
      const inner = freeVariables(term.body);
      inner.delete(term.param);
      return inner;
    }
    case "App":
      return new Set([...freeVariables(term.func), ...freeVariables(term.arg)]);
    default:
      return new Set();
  }
}

export function etaNormal(term: Term): Term {
  if (term.kind === "Abs") {
    const body = etaNormal(term.body);
    if (body.kind === "App" && body.arg.kind === "Var" && body.arg.name === term.param && !freeVariables(body.func).has(term.param)) {
      return body.func;
    }
    return {...term, body};
  }
  if (term.kind === "App") return {...term, func: etaNormal(term.func), arg: etaNormal(term.arg)};
  return term;
}

export const equalTerms = (a: Term, b: Term) => termsAlphaEqual(a, b);
export const printTerm = (term: Term) => termKey(term);

export interface VariableOccurrence {
  column: number;
  length: number;
  name: string;
  free: boolean;
}

// Uses the parser's source positions to map every variable occurrence back to the text the student sees.
export function variableOccurrences(term: Term): VariableOccurrence[] {
  const found: VariableOccurrence[] = [];
  const walk = (node: Term, bound: ReadonlySet<string>) => {
    if (node.kind === "Var") {
      found.push({column: node.pos?.column ?? 0, length: node.name.length, name: node.name, free: !bound.has(node.name)});
    } else if (node.kind === "Abs") {
      walk(node.body, new Set(bound).add(node.param));
    } else if (node.kind === "App") {
      walk(node.func, bound);
      walk(node.arg, bound);
    }
  };
  walk(term, new Set());
  return found;
}

// Solution style: every application wrapped, and an abstraction wrapped when it is an operand.
export function fullyParenthesized(term: Term, operand = false): string {
  switch (term.kind) {
    case "Var":
      return term.name;
    case "Abs": {
      const text = `λ${term.param}. ${fullyParenthesized(term.body)}`;
      return operand ? `(${text})` : text;
    }
    case "App":
      return `(${fullyParenthesized(term.func, true)} ${fullyParenthesized(term.arg, true)})`;
    default:
      return termKey(term);
  }
}

export function requiredParentheses(term: Term, operand = false): number {
  switch (term.kind) {
    case "Abs":
      return (operand ? 1 : 0) + requiredParentheses(term.body);
    case "App":
      return 1 + requiredParentheses(term.func, true) + requiredParentheses(term.arg, true);
    default:
      return 0;
  }
}

const MAX_NUMERAL = 30;

// Church booleans and numerals shown in the labs' own notation; undefined for anything else.
export function decodeChurch(term: Term): string | undefined {
  const candidates = ["true", "false", ...Array.from({length: MAX_NUMERAL + 1}, (_, n) => String(n))];
  return candidates.find((candidate) => {
    const parsed = parseLambda(labNotation(candidate), true);
    return parsed.ok && equalTerms(normalize(parsed.program).result, term);
  });
}
