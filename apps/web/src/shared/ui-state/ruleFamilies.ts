import {Rule} from "@vladyslav005/tt-core";

export function isCtRule(rule: Rule): boolean {
  return rule.startsWith("Ct");
}

// A variable lookup — plain, monomorphic constraint-typing, or let-polymorphic (instantiating a scheme).
export function isVarRule(rule: Rule): boolean {
  return rule === Rule.Var || rule === Rule.CtVar || rule === Rule.CtVarLet;
}
