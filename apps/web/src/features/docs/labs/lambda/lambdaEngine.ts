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
const evaluator = new Evaluator();

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

export function parseLambda(text: string, withPrelude = false): Parsed {
  const source = text.trim().replace(/[;\s]+$/, "");
  if (!source) return {ok: false, message: "nothing written here"};
  try {
    const program = parser.parseExpression(`${withPrelude ? `${PRELUDE_CODE}\n` : ""}${source};`);
    if (!program.term) return {ok: false, message: "not a term"};
    return {ok: true, program, term: program.term};
  } catch (error) {
    return {ok: false, message: messageOf(error)};
  }
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
