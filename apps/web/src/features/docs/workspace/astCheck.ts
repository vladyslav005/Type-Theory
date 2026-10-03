import type {Program, Term} from "@vladyslav005/tt-core";
import type {AstFlowGraph} from "@/shared/presentation/flow/types.ts";

export type NodeVerdict = "valid" | "invalid";

export interface AstCheck {
  verdicts: Record<string, NodeVerdict>;
  wrong: number;
  missing: number;
  loose: number;
  correct: boolean;
}

const isTerm = (value: unknown): value is Term =>
  typeof value === "object" && value !== null && typeof (value as {kind?: unknown}).kind === "string"
  && !(value as {kind: string}).kind.startsWith("Ty") && !(value as {kind: string}).kind.endsWith("Type");

// Sub-terms in a fixed order; an if's branches by role, so a missing else is noticed.
function children(term: Term): (Term | undefined)[] {
  if (term.kind === "IfCondition") return [term.condition, term.then, term.else];
  return Object.entries(term).filter(([key, value]) => key !== "pos" && isTerm(value)).map(([, value]) => value as Term);
}

// The node's own content, apart from its children: literal value, variable or parameter name, operator.
const ownLabel = (term: Term) => {
  const t = term as {value?: unknown; name?: unknown; param?: unknown; operator?: unknown};
  return `${term.kind}|${String(t.value ?? "")}|${String(t.name ?? "")}|${String(t.param ?? "")}|${String(t.operator ?? "")}`;
};

// Compares the student's tree node by node; never reports what the expected node is.
export function checkAst(program: Program, graph: AstFlowGraph, expected: Term): AstCheck {
  const placed = new Set(graph.nodes.filter((n) => n.type !== "program").map((n) => n.id));
  const reached = new Set<string>();
  const verdicts: Record<string, NodeVerdict> = {};
  let wrong = 0;
  let missing = 0;

  // A child that is only the editor's placeholder (no node connected) counts as an empty slot.
  const isPlaced = (term: Term | undefined): term is Term => !!term && placed.has(term.id);

  const markReached = (term: Term) => {
    if (!placed.has(term.id)) return;
    reached.add(term.id);
    children(term).forEach((child) => child && markReached(child));
  };

  const walk = (built: Term | undefined, want: Term | undefined) => {
    if (!want) return;
    if (!isPlaced(built)) {
      missing += 1;
      return;
    }
    reached.add(built.id);
    if (ownLabel(built) !== ownLabel(want)) {
      verdicts[built.id] = "invalid";
      wrong += 1;
      children(built).forEach((child) => child && markReached(child));
      return;
    }
    const mine = children(built);
    const theirs = children(want);
    const extra = mine.some((child, i) => isPlaced(child) && !theirs[i]);
    verdicts[built.id] = extra ? "invalid" : "valid";
    if (extra) wrong += 1;
    theirs.forEach((child, i) => walk(mine[i], child));
    mine.forEach((child, i) => !theirs[i] && child && markReached(child));
  };

  walk(program.term, expected);
  const loose = [...placed].filter((id) => !reached.has(id)).length;
  for (const id of placed) if (!reached.has(id)) verdicts[id] = "invalid";
  return {verdicts, wrong, missing, loose, correct: wrong === 0 && missing === 0 && loose === 0};
}
