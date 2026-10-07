import type {ManualNode, ManualNodeResult, ManualVerdict} from "@/shared/ui-state/manualProof.ts";
import {definitionName, splitDefinition} from "@/shared/lib/manualParse.ts";

const REFERENCE = /(Γ|\\Gamma|Gamma|C)(?:_?\{?(\d+)\}?|([₀-₉]+))?(?![\w'₀-₉])/g;
const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

function referencedNames(text: string): Set<string> {
  // An inline "Γ_2 = …" field defines Γ_2; only its right-hand side uses other names.
  const source = splitDefinition(text)?.rhs ?? text;
  const names = new Set<string>();
  for (const match of source.matchAll(REFERENCE)) {
    const kind = match[1] === "C" ? "C" : "Γ";
    const index = match[2] !== undefined
      ? Number(match[2])
      : match[3] !== undefined ? Number([...match[3]].map((c) => SUBSCRIPTS.indexOf(c)).join("")) : null;
    if (kind === "C" && index === null) continue;
    names.add(definitionName(kind, index));
  }
  return names;
}

export interface FailingDefinition {
  line: number;
  name: string;
}

// Definitions-box lines whose every checked use is marked wrong: the definition itself is the likely culprit.
export function failingDefinitions(text: string, tree: ManualNode, results: Record<string, ManualNodeResult>): FailingDefinition[] {
  const uses = new Map<string, {total: number; failed: number}>();
  const record = (fieldText: string, verdict: ManualVerdict | undefined) => {
    if (verdict === undefined) return;
    for (const name of referencedNames(fieldText)) {
      const entry = uses.get(name) ?? {total: 0, failed: 0};
      entry.total += 1;
      if (verdict === "invalid") entry.failed += 1;
      uses.set(name, entry);
    }
  };
  const visit = (node: ManualNode) => {
    const result = results[node.id];
    if (result) {
      if (node.kind === "fact") record(node.fact, result.fact);
      else {
        record(node.gamma, result.gamma);
        record(node.constraints, result.constraints);
      }
    }
    node.premises.forEach(visit);
  };
  visit(tree);

  return text.split("\n").flatMap((raw, i) => {
    const definition = splitDefinition(raw.trim());
    if (!definition) return [];
    const name = definitionName(definition.kind, definition.index);
    const use = uses.get(name);
    return use && use.total > 0 && use.failed === use.total ? [{line: i + 1, name}] : [];
  });
}
