import {Rule, TexMapper, type BinaryOperator, type ProofTree, type Term} from "@vladyslav005/tt-core";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";
import {isCtRule} from "@/shared/ui-state/ruleFamilies.ts";
import type {FeedbackMessage} from "./feedback.ts";

export interface ChosenRule {
  rule: Rule;
  def?: boolean;
  operator?: BinaryOperator;
  literal?: string;
}

const OPERATORS: BinaryOperator[] = ["+", "-", "*", "/", "<", ">", "<=", ">=", "==", "!="];
const LITERAL_NAMES = ["Lit", "Unit", "True", "False", "String", "Nv", "Zero"];

const RULE_KIND_EXCEPTIONS: Partial<Record<string, Term["kind"]>> = {
  VarLet: "Var",
  AbsInf: "Abs",
  DummyAbs: "DummyAbstraction",
  If: "IfCondition",
  TPiApp: "App",
};

export function ruleTermKind(rule: Rule): string {
  const base = isCtRule(rule) ? rule.slice(2) : rule;
  return RULE_KIND_EXCEPTIONS[base] ?? base;
}

const normalize = (text: string) => text.replace(/[\s–—−_-]/g, "").toLowerCase();

// Reads a hand-written rule name (fully manual builder); undefined when no such rule exists.
export function parseRuleLabel(text: string): ChosenRule | undefined {
  const written = normalize(text);
  for (const [rule, label] of Object.entries(RULE_LABELS)) {
    if (label && normalize(label) === written) return {rule: rule as Rule};
  }
  for (const ct of [false, true]) {
    const prefix = ct ? "CT-" : "T-";
    if (normalize(`${prefix}Def`) === written) return {rule: ct ? Rule.CtVar : Rule.Var, def: true};
    for (const name of LITERAL_NAMES) {
      if (normalize(`${prefix}${name}`) === written) return {rule: ct ? Rule.CtLit : Rule.Lit, literal: name};
    }
    for (const operator of OPERATORS) {
      if (normalize(`${prefix}${TexMapper.binOpRuleName(operator)}`) === written) return {rule: ct ? Rule.CtBinOp : Rule.BinOp, operator};
    }
  }
  return undefined;
}

const literalClass = (value: string) =>
  value === "true" || value === "True" ? "True"
    : value === "false" || value === "False" ? "False"
      : value === "unit" || value === "Unit" ? "Unit"
        : value.startsWith("\"") ? "String" : "Nv";

// Says what is wrong with the student's rule — never which rule is right.
export function ruleFeedback(chosen: ChosenRule | undefined, label: string, answer: ProofTree): FeedbackMessage {
  if (!chosen) return {code: "feedback.ruleUnknown", params: {rule: label}};
  const term = answer.term as Term;
  if (ruleTermKind(chosen.rule) !== term.kind) return {code: "feedback.ruleShape", params: {rule: label}};
  if (isCtRule(chosen.rule) !== isCtRule(answer.rule)) return {code: "feedback.ruleFamily", params: {rule: label}};
  if (term.kind === "BinOp" && chosen.operator && chosen.operator !== term.operator) {
    return {code: "feedback.ruleOperator", params: {rule: label}};
  }
  const literalMatches = (literal: string) => literal === literalClass(term.kind === "Lit" ? term.value : "") || (literal === "Zero" && term.kind === "Lit" && term.value === "0");
  if (term.kind === "Lit" && chosen.literal && chosen.literal !== "Lit" && !literalMatches(chosen.literal)) {
    return {code: "feedback.ruleLiteral", params: {rule: label}};
  }
  return {code: "feedback.ruleOther", params: {rule: label}};
}
