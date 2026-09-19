import type {ManualNode} from "@/shared/ui-state/manualProof.ts";

const FORMAT = "tt-manual-proof";
const VERSION = 1;
const MAX_DEPTH = 200;

export interface ManualFile {
  term: string;
  tree: ManualNode;
  definitions: string;
}

export function serializeManualProof(file: ManualFile): string {
  return JSON.stringify({format: FORMAT, version: VERSION, ...file}, null, 2);
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

// Rebuilds every node from known fields only, with fresh ids, so a hand-edited file can't smuggle in anything else.
function sanitize(raw: unknown, depth: number): ManualNode {
  if (!raw || typeof raw !== "object" || depth > MAX_DEPTH) throw new Error("bad node");
  const node = raw as Record<string, unknown>;
  if (node.kind !== "judgement" && node.kind !== "fact") throw new Error("bad node kind");
  return {
    id: crypto.randomUUID(),
    kind: node.kind,
    rule: text(node.rule),
    gamma: text(node.gamma),
    term: text(node.term),
    type: text(node.type),
    constraints: text(node.constraints),
    constraintsShown: typeof node.constraintsShown === "boolean" ? node.constraintsShown : undefined,
    fact: text(node.fact),
    premises: Array.isArray(node.premises) ? node.premises.map((p) => sanitize(p, depth + 1)) : [],
  };
}

export function parseManualProof(source: string): ManualFile {
  const data = JSON.parse(source);
  if (data?.format !== FORMAT) throw new Error("not a manual proof file");
  return {term: text(data.term), tree: sanitize(data.tree, 0), definitions: text(data.definitions)};
}
