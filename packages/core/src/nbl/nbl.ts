export type NblTerm =
  | {kind: "true"}
  | {kind: "false"}
  | {kind: "zero"}
  | {kind: "succ" | "pred" | "iszero"; arg: NblTerm}
  | {kind: "if"; cond: NblTerm; then: NblTerm; else: NblTerm};

export type NblKind = NblTerm["kind"];

export type NblParseResult =
  | {ok: true; term: NblTerm}
  | {ok: false; message: string; position: number};

interface Token {
  text: string;
  position: number;
}

const KEYWORDS = new Set(["true", "false", "0", "succ", "pred", "iszero", "if", "then", "else"]);

class NblSyntaxError extends Error {
  constructor(message: string, readonly position: number) {
    super(message);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(\(|\)|[A-Za-z0-9_]+|\S)/gy;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    tokens.push({text: match[1], position: match.index + match[0].length - match[1].length});
  }
  return tokens;
}

export function parseNbl(source: string): NblParseResult {
  const tokens = tokenize(source);
  let index = 0;

  const peek = () => tokens[index];
  const expect = (text: string) => {
    const token = tokens[index];
    if (!token || token.text !== text) {
      throw new NblSyntaxError(
        token ? `expected "${text}", found "${token.text}"` : `expected "${text}", found end of input`,
        token?.position ?? source.length,
      );
    }
    index += 1;
  };

  const parseTerm = (): NblTerm => {
    const token = peek();
    if (!token) throw new NblSyntaxError("unexpected end of input", source.length);

    switch (token.text) {
      case "if": {
        index += 1;
        const cond = parseTerm();
        expect("then");
        const thenBranch = parseTerm();
        expect("else");
        const elseBranch = parseTerm();
        return {kind: "if", cond, then: thenBranch, else: elseBranch};
      }
      case "succ":
      case "pred":
      case "iszero":
        index += 1;
        return {kind: token.text, arg: parseTerm()};
      case "true":
        index += 1;
        return {kind: "true"};
      case "false":
        index += 1;
        return {kind: "false"};
      case "0":
        index += 1;
        return {kind: "zero"};
      case "(": {
        index += 1;
        const inner = parseTerm();
        expect(")");
        return inner;
      }
      default:
        throw new NblSyntaxError(
          KEYWORDS.has(token.text) ? `unexpected "${token.text}"` : `unknown symbol "${token.text}"`,
          token.position,
        );
    }
  };

  try {
    const term = parseTerm();
    const rest = peek();
    if (rest) throw new NblSyntaxError(`unexpected "${rest.text}"`, rest.position);
    return {ok: true, term};
  } catch (error) {
    if (error instanceof NblSyntaxError) return {ok: false, message: error.message, position: error.position};
    throw error;
  }
}

export function printNbl(term: NblTerm): string {
  const atom = (t: NblTerm) => (t.kind === "true" || t.kind === "false" || t.kind === "zero" ? printNbl(t) : `(${printNbl(t)})`);
  switch (term.kind) {
    case "true":
    case "false":
      return term.kind;
    case "zero":
      return "0";
    case "succ":
    case "pred":
    case "iszero":
      return `${term.kind} ${atom(term.arg)}`;
    case "if":
      return `if ${printNbl(term.cond)} then ${printNbl(term.then)} else ${printNbl(term.else)}`;
  }
}

export function nblChildren(term: NblTerm): NblTerm[] {
  switch (term.kind) {
    case "succ":
    case "pred":
    case "iszero":
      return [term.arg];
    case "if":
      return [term.cond, term.then, term.else];
    default:
      return [];
  }
}

export function nblEquals(a: NblTerm, b: NblTerm): boolean {
  if (a.kind !== b.kind) return false;
  const left = nblChildren(a);
  const right = nblChildren(b);
  return left.every((child, i) => nblEquals(child, right[i]));
}

export function nblSize(term: NblTerm): number {
  return 1 + nblChildren(term).reduce((sum, child) => sum + nblSize(child), 0);
}

export function nblDepth(term: NblTerm): number {
  return 1 + nblChildren(term).reduce((max, child) => Math.max(max, nblDepth(child)), 0);
}

export function nblConstants(term: NblTerm): Set<"0" | "true" | "false"> {
  if (term.kind === "true" || term.kind === "false") return new Set([term.kind]);
  if (term.kind === "zero") return new Set(["0"]);
  return new Set(nblChildren(term).flatMap((child) => [...nblConstants(child)]));
}

export function isNblNumericValue(term: NblTerm): boolean {
  return term.kind === "zero" || (term.kind === "succ" && isNblNumericValue(term.arg));
}

export function isNblValue(term: NblTerm): boolean {
  return term.kind === "true" || term.kind === "false" || isNblNumericValue(term);
}

export interface NblStep {
  term: NblTerm;
  // the axiom that fired; the congruence rules (E-If, E-Succ, ...) that lead down to it are implied
  rule: string;
}

export function nblStep(term: NblTerm): NblStep | undefined {
  switch (term.kind) {
    case "if": {
      if (term.cond.kind === "true") return {term: term.then, rule: "E-IfTrue"};
      if (term.cond.kind === "false") return {term: term.else, rule: "E-IfFalse"};
      const inner = nblStep(term.cond);
      return inner && {term: {...term, cond: inner.term}, rule: inner.rule};
    }
    case "succ": {
      const inner = nblStep(term.arg);
      return inner && {term: {kind: "succ", arg: inner.term}, rule: inner.rule};
    }
    case "pred": {
      if (term.arg.kind === "zero") return {term: term.arg, rule: "E-PredZero"};
      if (term.arg.kind === "succ" && isNblNumericValue(term.arg.arg)) return {term: term.arg.arg, rule: "E-PredSucc"};
      const inner = nblStep(term.arg);
      return inner && {term: {kind: "pred", arg: inner.term}, rule: inner.rule};
    }
    case "iszero": {
      if (term.arg.kind === "zero") return {term: {kind: "true"}, rule: "E-IsZeroZero"};
      if (term.arg.kind === "succ" && isNblNumericValue(term.arg.arg)) return {term: {kind: "false"}, rule: "E-IsZeroSucc"};
      const inner = nblStep(term.arg);
      return inner && {term: {kind: "iszero", arg: inner.term}, rule: inner.rule};
    }
    default:
      return undefined;
  }
}

export interface NblEvaluation {
  steps: NblStep[];
  result: NblTerm;
  status: "value" | "stuck";
}

export function nblEvaluate(term: NblTerm, maxSteps = 1000): NblEvaluation {
  const steps: NblStep[] = [];
  let current = term;
  for (let i = 0; i < maxSteps; i += 1) {
    const step = nblStep(current);
    if (!step) break;
    steps.push(step);
    current = step.term;
  }
  return {steps, result: current, status: isNblValue(current) ? "value" : "stuck"};
}
