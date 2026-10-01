import type {App, ASTNode, Program, SourcePosition, Term} from "@/domain/ast";

const NBL_OPERATORS = {succ: "Succ", pred: "Pred", iszero: "IsZero"} as const;

type NblOperatorName = keyof typeof NBL_OPERATORS;

const isOperatorVar = (term: Term): term is Extract<Term, {kind: "Var"}> & {name: NblOperatorName} =>
  term.kind === "Var" && Object.hasOwn(NBL_OPERATORS, term.name);

function spanOf(first: Term, last: Term): SourcePosition | undefined {
  if (!first.pos || !last.pos) return first.pos ?? last.pos;
  const endLine = last.pos.endLine ?? last.pos.line;
  const endColumn = last.pos.endColumn ?? last.pos.column + last.pos.length;
  return {
    line: first.pos.line,
    column: first.pos.column,
    endLine,
    endColumn,
    length: endLine === first.pos.line ? endColumn - first.pos.column : first.pos.length,
  };
}

function flattenSpine(term: App): Term[] {
  const spine: Term[] = [];
  let current: Term = term;
  while (current.kind === "App") {
    spine.unshift(current.arg);
    current = current.func;
  }
  spine.unshift(current);
  return spine;
}

function rebuildApplication(terms: Term[]): Term {
  return terms.slice(1).reduce<Term>((func, arg) => ({
    kind: "App",
    id: crypto.randomUUID(),
    pos: spanOf(terms[0], arg),
    func,
    arg,
  }), terms[0]);
}

// The parser reads `succ succ 0` as `(succ succ) 0`; NBL reads operators prefix, right-nested.
function elaborateTerm(term: Term): Term {
  if (term.kind === "App") {
    const [head, ...args] = flattenSpine(term);
    if (isOperatorVar(head)) {
      return {
        kind: NBL_OPERATORS[head.name],
        id: term.id,
        pos: term.pos,
        term: elaborateTerm(rebuildApplication(args)),
      };
    }
  }
  return mapChildren(term) as Term;
}

function isAstNode(value: unknown): value is ASTNode {
  return typeof value === "object" && value !== null && typeof (value as {kind?: unknown}).kind === "string";
}

function mapValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mapValue);
  if (isAstNode(value)) return elaborateTerm(value as Term);
  if (typeof value === "object" && value !== null) return mapChildren(value);
  return value;
}

function mapChildren<T extends object>(node: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = key === "pos" ? value : mapValue(value);
  }
  return result as T;
}

// Turns applications of the NBL operator names into Succ/Pred/IsZero nodes; run only when NBL is enabled.
export function elaborateNbl(program: Program): Program {
  return mapChildren(program);
}
