import {Rule, TexMapper, type BinaryOperator, type StlcFeatureConfig, type TypeTheoryConfig} from "@vladyslav005/tt-core";
import {isCtRule} from "@/shared/ui-state/ruleFamilies.ts";
import {RULE_LABELS, rulesForTheories} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";

const LIT_ALIASES = ["Unit", "True", "False", "String", "Nv", "Zero"];
const BIN_OPS: BinaryOperator[] = ["+", "-", "*", "/", "<", ">", "<=", ">=", "==", "!="];

// Every rule name manualCheck accepts under the enabled theories, aliases after the main labels.
export function ruleSuggestions(theories: TypeTheoryConfig, features: StlcFeatureConfig): string[] {
  const rules = rulesForTheories(theories, features);
  const names = new Set<string>();
  rules.forEach((rule) => {
    const label = RULE_LABELS[rule];
    if (label) names.add(label);
  });
  for (const rule of rules) {
    const prefix = isCtRule(rule) ? "CT-" : "T-";
    if (rule === Rule.Var || rule === Rule.CtVar) names.add(`${prefix}Def`);
    if (rule === Rule.Lit || rule === Rule.CtLit) LIT_ALIASES.forEach((n) => names.add(`${prefix}${n}`));
    if (rule === Rule.BinOp || rule === Rule.CtBinOp) BIN_OPS.forEach((op) => names.add(`${prefix}${TexMapper.binOpRuleName(op)}`));
  }
  return [...names];
}

const normalize = (text: string) => text.replace(/[\s–—−_-]/g, "").toLowerCase();

export function filterRuleSuggestions(all: string[], query: string): string[] {
  const q = normalize(query);
  if (!q) return all;
  const body = (name: string) => normalize(name.replace(/^C?T-/, ""));
  const rank = (name: string) => normalize(name).startsWith(q) ? 0 : body(name).startsWith(q) ? 1 : 2;
  return all
    .filter((name) => normalize(name).includes(q))
    .map((name, i) => ({name, i, r: rank(name)}))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({name}) => name);
}
