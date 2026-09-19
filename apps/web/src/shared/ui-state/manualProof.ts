import type {Type, TypeScheme} from "@vladyslav005/tt-core";
import {typeToString} from "@vladyslav005/tt-core";
import {typeSchemeToDisplayType} from "@/shared/ui-state/studentProof.ts";

export type ManualVerdict = "valid" | "invalid";

export interface ManualMessage {
  code: string;
  params?: Record<string, string | number>;
}

export interface ManualNodeResult {
  rule?: ManualVerdict;
  gamma?: ManualVerdict;
  term?: ManualVerdict;
  type?: ManualVerdict;
  constraints?: ManualVerdict;
  premises?: ManualVerdict;
  fact?: ManualVerdict;
  messages: ManualMessage[];
}

export interface ManualNode {
  id: string;
  kind: "judgement" | "fact";
  rule: string;
  gamma: string;
  term: string;
  type: string;
  constraints: string;
  // undefined follows the enabled theories
  constraintsShown?: boolean;
  fact: string;
  premises: ManualNode[];
}

export type ManualField = "rule" | "gamma" | "term" | "type" | "constraints" | "fact";

export function contextToText(gamma: Record<string, Type | TypeScheme>, braces = false): string {
  const entries = Object.entries(gamma);
  if (entries.length === 0) return "∅";
  const text = entries
    .map(([name, value]) => `${name} : ${typeToString(value.kind === "TypeScheme" ? typeSchemeToDisplayType(value) : value)}`)
    .join(", ");
  return braces ? `{${text}}` : text;
}

export function createManualNode(kind: ManualNode["kind"] = "judgement", term = ""): ManualNode {
  return {
    id: crypto.randomUUID(),
    kind,
    rule: "",
    gamma: "",
    term,
    type: "",
    constraints: "",
    fact: "",
    premises: [],
  };
}

export function findManualNode(root: ManualNode, id: string): ManualNode | undefined {
  if (root.id === id) return root;
  for (const premise of root.premises) {
    const found = findManualNode(premise, id);
    if (found) return found;
  }
  return undefined;
}

export function removeManualNode(root: ManualNode, id: string): void {
  root.premises = root.premises.filter((p) => p.id !== id);
  root.premises.forEach((p) => removeManualNode(p, id));
}

export function countManualNodes(node: ManualNode): number {
  return 1 + node.premises.reduce((n, p) => n + countManualNodes(p), 0);
}
