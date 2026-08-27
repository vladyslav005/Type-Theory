import {Rule} from "@vladyslav005/tt-core";
import type {TypeTheoryConfig, TypeTheoryId} from "@vladyslav005/tt-core";

// Display labels for every rule the student can pick, matching TexMapper's labels where one exists.
export const RULE_LABELS: Partial<Record<Rule, string>> = {
  [Rule.Var]: "T-Var",
  [Rule.Abs]: "T-Abs",
  [Rule.App]: "T-App",
  [Rule.Lit]: "T-Lit",
  [Rule.If]: "T-If",
  [Rule.Inl]: "T-Inl",
  [Rule.Inr]: "T-Inr",
  [Rule.Case]: "T-Case",
  [Rule.Variant]: "T-Variant",
  [Rule.VariantCase]: "T-VariantCase",
  [Rule.Tuple]: "T-Tuple",
  [Rule.TupleProjection]: "T-Proj",
  [Rule.Record]: "T-Record",
  [Rule.RecordProjection]: "T-RecordProj",
  [Rule.Sequencing]: "T-Seq",
  [Rule.DummyAbs]: "T-Wildcard",
  [Rule.Ascribe]: "T-Ascribe",
  [Rule.BinOp]: "T-BinOp",
  [Rule.Fix]: "T-Fix",
  [Rule.Let]: "T-Let",
  [Rule.Nil]: "T-Nil",
  [Rule.Cons]: "T-Cons",
  [Rule.IsNil]: "T-IsNil",
  [Rule.Head]: "T-Head",
  [Rule.Tail]: "T-Tail",
  [Rule.Fold]: "T-Fold",
  [Rule.Unfold]: "T-Unfold",
  [Rule.TypeAbs]: "T-TAbs",
  [Rule.TypeApp]: "T-TApp",
  [Rule.TPiApp]: "T-PiApp",
};

// Which optional theory (if any) a rule requires — mirrors STLCTypeChecker's own gates. Lists have
// no toggle (always on), and System Fω never introduces a new *term* rule (only kind-checks existing
// annotations), so neither appears here.
const RULE_THEORY: Partial<Record<Rule, TypeTheoryId>> = {
  [Rule.Let]: "letPolymorphism",
  [Rule.Fold]: "isoRecursiveTypes",
  [Rule.Unfold]: "isoRecursiveTypes",
  [Rule.TypeAbs]: "systemF",
  [Rule.TypeApp]: "systemF",
  [Rule.TPiApp]: "systemLambdaP",
};

// The full rule set, in the order offered to the student.
export const BUILDER_RULES: readonly Rule[] = [
  Rule.Var,
  Rule.Abs,
  Rule.App,
  Rule.Lit,
  Rule.If,
  Rule.Inl,
  Rule.Inr,
  Rule.Case,
  Rule.Variant,
  Rule.VariantCase,
  Rule.Tuple,
  Rule.TupleProjection,
  Rule.Record,
  Rule.RecordProjection,
  Rule.Sequencing,
  Rule.DummyAbs,
  Rule.Ascribe,
  Rule.BinOp,
  Rule.Fix,
  Rule.Let,
  Rule.Nil,
  Rule.Cons,
  Rule.IsNil,
  Rule.Head,
  Rule.Tail,
  Rule.Fold,
  Rule.Unfold,
  Rule.TypeAbs,
  Rule.TypeApp,
  Rule.TPiApp,
];

// BUILDER_RULES filtered down to whichever theories are currently enabled.
export function rulesForTheories(theories: TypeTheoryConfig): Rule[] {
  return BUILDER_RULES.filter((rule) => {
    const required = RULE_THEORY[rule];
    return !required || theories[required];
  });
}
