import type {Edge} from "@xyflow/react";
import {typeToString} from "@vladyslav005/tt-core";
import type {AstFlowGraph, AstFlowNode} from "@/shared/presentation/flow/types.ts";

const TYPE_FLOW_TYPES = new Set(["type", "kind"]);

// Edges whose label carries a binder or a field name the node label doesn't show.
const KEEP_EDGE_LABEL = /^(inl-term|inr-term|case-|field-|elif-)/;

const STATIC_SLOTS: Record<string, string[]> = {
  App: ["left", "right"],
  Ascribe: ["term", "type"],
  BinOp: ["leftOperand", "rightOperand"],
  Case: ["variable", "inl-term", "inr-term"],
  Cons: ["head", "tail", "type"],
  DummyAbstraction: ["paramType", "body"],
  Fix: ["term"],
  Fold: ["term", "type"],
  Unfold: ["term", "type"],
  Head: ["term", "type"],
  Tail: ["term", "type"],
  IsNil: ["term", "type"],
  Inl: ["term", "type"],
  Inr: ["term", "type"],
  Let: ["value", "body"],
  Succ: ["term"],
  Pred: ["term"],
  IsZero: ["term"],
  Nil: ["type"],
  RecordProjection: ["term"],
  Sequencing: ["first", "second"],
  TupleProjection: ["tuple"],
  TypeAbs: ["body"],
  TypeApp: ["term", "typeArg"],
};

export function lectureSlots(term: any): string[] {
  if (!term) return [];
  switch (term.kind) {
    case "Var":
      return [DEF_SLOT];
    case "Abs":
      return term.type ? ["paramType", "body", "type"] : ["paramType", "body"];
    case "IfCondition":
      return [
        "condition", "then",
        ...(term.elif ?? []).flatMap((_: unknown, i: number) => [`elif-${i}-condition`, `elif-${i}-then`]),
        "else",
      ];
    case "Record":
      return (term.fields ?? []).map((_: unknown, i: number) => `field-${i}`);
    case "Tuple":
      return (term.elements ?? []).map((_: unknown, i: number) => `el-${i}`);
    case "Variant":
      return [...(term.variants ?? []).map((_: unknown, i: number) => `field-${i}`), "type"];
    case "VariantCase":
      return ["variable", ...(term.cases ?? []).map((_: unknown, i: number) => `case-${i}`)];
    default:
      return STATIC_SLOTS[term.kind] ?? [];
  }
}

function safeType(type: any): string | undefined {
  try {
    return type ? typeToString(type) : undefined;
  } catch {
    return undefined;
  }
}

export function lectureLabel(term: any): string {
  if (!term) return "?";
  switch (term.kind) {
    case "Var": return term.name;
    case "Lit": return String(term.value);
    case "Abs": return `λ${term.param}`;
    case "App": return "app";
    case "DummyAbstraction": return "λ_";
    case "Let": return `let ${term.name}`;
    case "IfCondition": return "if";
    case "Inl": return "inl";
    case "Inr": return "inr";
    case "Case":
    case "VariantCase": return "case";
    case "Variant": return "variant";
    case "Ascribe": {
      const type = safeType(term.type);
      return type ? `as ${type}` : "as";
    }
    case "TupleProjection": return `.${term.index}`;
    case "RecordProjection": return `.${term.label}`;
    case "Record": return "record";
    case "Tuple": return "tuple";
    case "Sequencing": return ";";
    case "BinOp": return String(term.operator);
    case "Fix": return "fix";
    case "Succ": return "succ";
    case "Pred": return "pred";
    case "IsZero": return "iszero";
    case "Nil": return "nil";
    case "Cons": return "cons";
    case "IsNil": return "isnil";
    case "Head": return "head";
    case "Tail": return "tail";
    case "Fold": return "fold";
    case "Unfold": return "unfold";
    case "TypeAbs": return `Λ${term.typeParam}`;
    case "TypeApp": {
      const type = safeType(term.typeArg);
      return type ? `[${type}]` : "[ ]";
    }
    default: return safeType(term) ?? String(term.kind);
  }
}

function lectureEdge(edge: Edge): Edge {
  const keepLabel = !!edge.sourceHandle && KEEP_EDGE_LABEL.test(edge.sourceHandle);
  return {
    ...edge,
    type: "straight",
    label: keepLabel ? edge.label : undefined,
    markerEnd: undefined,
    style: {...edge.style, stroke: "var(--foreground)", strokeWidth: 1.25},
  };
}

const DEF_SLOT = "def";

function boundBy(term: any, handle: string | null | undefined): string | undefined {
  switch (term?.kind) {
    case "Abs": return term.param;
    case "Let": return handle === "body" ? term.name : undefined;
    case "Case": return handle === "inl-term" ? term.inl?.variable : handle === "inr-term" ? term.inr?.variable : undefined;
    case "VariantCase": {
      const match = handle?.match(/^case-(\d+)$/);
      return match ? term.cases?.[Number(match[1])]?.variable : undefined;
    }
    default: return undefined;
  }
}

export function isGlobalRef(node: AstFlowNode): boolean {
  return !!(node.data as any)?.globalRef;
}

// Only the main expression's term tree: no program node, declarations or type annotations.
// A free variable naming a global declaration unfolds into that declaration's term when its id is in `expanded`.
export function toLectureGraph(graph: AstFlowGraph, expanded: ReadonlySet<string> = new Set()): AstFlowGraph {
  const program = graph.nodes.find((node) => node.type === "program");
  const rootId = program
    ? graph.edges.find((edge) => edge.source === program.id && edge.sourceHandle === "term")?.target
    : graph.nodes.find((node) => !graph.edges.some((edge) => edge.target === node.id))?.id;
  if (!rootId) return {nodes: [], edges: []};

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const globals = new Map<string, string>();
  for (const decl of ((program?.data as any)?.term?.globals ?? []) as any[]) {
    if (decl.kind !== "FunDecl" && decl.kind !== "VarDecl") continue;
    const valueId = graph.edges.find((edge) => edge.source === decl.id && edge.sourceHandle === "value")?.target;
    if (valueId) globals.set(decl.name, valueId);
  }

  const nodes: AstFlowNode[] = [];
  const edges: Edge[] = [];
  const seen = new Set<string>();

  const walk = (id: string, prefix: string, bound: ReadonlySet<string>, unfolding: ReadonlySet<string>) => {
    const source = byId.get(id)!;
    const newId = prefix + id;
    seen.add(newId);
    const term = (source.data as any)?.term;
    const globalValue = term?.kind === "Var" && !bound.has(term.name) && !unfolding.has(term.name) ? globals.get(term.name) : undefined;
    const isExpanded = !!globalValue && expanded.has(newId);
    nodes.push({...source, id: newId, data: globalValue ? {...source.data, globalRef: true, expanded: isExpanded} : source.data} as AstFlowNode);

    for (const edge of graph.edges) {
      if (edge.source !== id || seen.has(prefix + edge.target)) continue;
      const target = byId.get(edge.target);
      if (!target || TYPE_FLOW_TYPES.has(target.type as string)) continue;
      const name = boundBy(term, edge.sourceHandle);
      edges.push(lectureEdge({...edge, id: prefix + edge.id, source: newId, target: prefix + edge.target}));
      walk(edge.target, prefix, name ? new Set([...bound, name]) : bound, unfolding);
    }

    if (isExpanded) {
      const childPrefix = `${newId}/`;
      edges.push({
        id: `${childPrefix}def`,
        source: newId,
        sourceHandle: DEF_SLOT,
        target: childPrefix + globalValue,
        type: "straight",
        style: {stroke: "var(--primary)", strokeWidth: 1.25, strokeDasharray: "4 3"},
      });
      walk(globalValue, childPrefix, new Set(), new Set([...unfolding, term.name]));
    }
  };

  walk(rootId, "", new Set(), new Set());
  return {nodes, edges};
}

const H_GAP = 28;
const V_GAP = 48;
const ROOT_GAP = 64;

function nodeSize(node: AstFlowNode): {width: number; height: number} {
  const measured = (node as any).measured as {width?: number; height?: number} | undefined;
  if (measured?.width && measured?.height) return {width: measured.width, height: measured.height};
  const label = lectureLabel((node.data as any)?.term);
  return {width: Math.max(28, label.length * 12 + 12), height: 32};
}

// Classic textbook tree: children in slot order, each parent centred over its first and last child.
export function layoutLectureTree(nodes: AstFlowNode[], edges: Edge[]): AstFlowGraph {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const targets = new Set<string>();

  const sorted = edges
    .map((edge, index) => {
      const parent = byId.get(edge.source);
      const slots = lectureSlots((parent?.data as any)?.term);
      const slot = edge.sourceHandle ? slots.indexOf(edge.sourceHandle) : -1;
      return {edge, rank: slot === -1 ? slots.length : slot, index};
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  for (const {edge} of sorted) {
    if (!byId.has(edge.source) || !byId.has(edge.target) || targets.has(edge.target)) continue;
    targets.add(edge.target);
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  }

  const sizes = new Map(nodes.map((node) => [node.id, nodeSize(node)]));
  const widths = new Map<string, number>();
  const visiting = new Set<string>();

  const measure = (id: string): number => {
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const kids = children.get(id) ?? [];
    const kidsWidth = kids.reduce((sum, kid) => sum + measure(kid), 0) + Math.max(0, kids.length - 1) * H_GAP;
    const width = Math.max(sizes.get(id)!.width, kidsWidth);
    widths.set(id, width);
    return width;
  };

  const positions = new Map<string, {x: number; y: number}>();
  const place = (id: string, left: number, top: number): number => {
    const {width, height} = sizes.get(id)!;
    const subtree = widths.get(id) ?? width;
    const kids = (children.get(id) ?? []).filter((kid) => widths.has(kid) && !positions.has(kid));
    let center = left + subtree / 2;
    if (kids.length > 0) {
      const kidsWidth = kids.reduce((sum, kid) => sum + widths.get(kid)!, 0) + (kids.length - 1) * H_GAP;
      let cursor = left + (subtree - kidsWidth) / 2;
      const centers = kids.map((kid) => {
        const kidCenter = place(kid, cursor, top + height + V_GAP);
        cursor += widths.get(kid)! + H_GAP;
        return kidCenter;
      });
      center = (centers[0] + centers[centers.length - 1]) / 2;
    }
    positions.set(id, {x: center - width / 2, y: top});
    return center;
  };

  const roots = nodes.filter((node) => !targets.has(node.id));
  let left = 0;
  for (const root of roots) {
    measure(root.id);
    place(root.id, left, 0);
    left += widths.get(root.id)! + ROOT_GAP;
  }

  return {
    nodes: nodes.map((node) => ({...node, position: positions.get(node.id) ?? node.position})),
    edges,
  };
}
