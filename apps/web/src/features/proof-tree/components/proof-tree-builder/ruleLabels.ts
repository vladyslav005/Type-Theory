import {Rule} from "@vladyslav005/tt-core";
import {DEFAULT_STLC_FEATURES, type StlcFeatureConfig, type StlcFeatureId, type TypeTheoryConfig, type TypeTheoryId} from "@vladyslav005/tt-core";
import {isCtRule} from "@/shared/ui-state/ruleFamilies.ts";

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
  [Rule.Succ]: "T-Succ",
  [Rule.Pred]: "T-Pred",
  [Rule.IsZero]: "T-IsZero",
};

const CT_LABELS: Partial<Record<Rule, string>> = {
  [Rule.CtVar]: "CT-Var",
  [Rule.CtVarLet]: "CT-VarLet",
  [Rule.CtAbs]: "CT-Abs",
  [Rule.CtAbsInf]: "CT-Abs",
  [Rule.CtApp]: "CT-App",
  [Rule.CtLit]: "CT-Lit",
  [Rule.CtIf]: "CT-If",
  [Rule.CtInl]: "CT-Inl",
  [Rule.CtInr]: "CT-Inr",
  [Rule.CtCase]: "CT-Case",
  [Rule.CtVariantCase]: "CT-VariantCase",
  [Rule.CtVariant]: "CT-Variant",
  [Rule.CtAscribe]: "CT-Ascribe",
  [Rule.CtTuple]: "CT-Tuple",
  [Rule.CtTupleProjection]: "CT-Proj",
  [Rule.CtRecord]: "CT-Record",
  [Rule.CtRecordProjection]: "CT-RecordProj",
  [Rule.CtSequencing]: "CT-Seq",
  [Rule.CtDummyAbs]: "CT-Wildcard",
  [Rule.CtLet]: "CT-Let",
  [Rule.CtBinOp]: "CT-BinOp",
  [Rule.CtFix]: "CT-Fix",
  [Rule.CtNil]: "CT-Nil",
  [Rule.CtCons]: "CT-Cons",
  [Rule.CtIsNil]: "CT-IsNil",
  [Rule.CtHead]: "CT-Head",
  [Rule.CtTail]: "CT-Tail",
  [Rule.CtFold]: "CT-Fold",
  [Rule.CtUnfold]: "CT-Unfold",
};

Object.assign(RULE_LABELS, CT_LABELS);

// Which optional theory (if any) a rule requires — mirrors STLCTypeChecker's own gates. Lists have
// no toggle (always on), and System Fω never introduces a new *term* rule (only kind-checks existing
// annotations), so neither appears here.
const RULE_THEORY: Partial<Record<Rule, TypeTheoryId>> = {
  [Rule.Fold]: "isoRecursiveTypes",
  [Rule.Unfold]: "isoRecursiveTypes",
  [Rule.CtLet]: "letPolymorphism",
  [Rule.CtFold]: "isoRecursiveTypes",
  [Rule.CtUnfold]: "isoRecursiveTypes",
  [Rule.TypeAbs]: "systemF",
  [Rule.TypeApp]: "systemF",
  [Rule.TPiApp]: "systemLambdaP",
  [Rule.Succ]: "typedNbl",
  [Rule.Pred]: "typedNbl",
  [Rule.IsZero]: "typedNbl",
};

const TYPED_NBL_RULES: readonly Rule[] = [Rule.Lit, Rule.If, Rule.Succ, Rule.Pred, Rule.IsZero];

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
  Rule.Succ,
  Rule.Pred,
  Rule.IsZero,
  Rule.CtVar,
  Rule.CtVarLet,
  Rule.CtAbs,
  Rule.CtApp,
  Rule.CtLit,
  Rule.CtIf,
  Rule.CtInl,
  Rule.CtInr,
  Rule.CtCase,
  Rule.CtVariant,
  Rule.CtVariantCase,
  Rule.CtTuple,
  Rule.CtTupleProjection,
  Rule.CtRecord,
  Rule.CtRecordProjection,
  Rule.CtSequencing,
  Rule.CtDummyAbs,
  Rule.CtAscribe,
  Rule.CtBinOp,
  Rule.CtFix,
  Rule.CtLet,
  Rule.CtNil,
  Rule.CtCons,
  Rule.CtIsNil,
  Rule.CtHead,
  Rule.CtTail,
  Rule.CtFold,
  Rule.CtUnfold,
];

// BUILDER_RULES filtered down to whichever theories are currently enabled.
const RULE_FEATURE: Partial<Record<Rule, StlcFeatureId>> = {
  [Rule.Inl]: "sums", [Rule.Inr]: "sums", [Rule.Case]: "sums", [Rule.Variant]: "sums", [Rule.VariantCase]: "sums",
  [Rule.CtInl]: "sums", [Rule.CtInr]: "sums", [Rule.CtCase]: "sums", [Rule.CtVariant]: "sums", [Rule.CtVariantCase]: "sums",
  [Rule.Tuple]: "tuples", [Rule.TupleProjection]: "tuples", [Rule.CtTuple]: "tuples", [Rule.CtTupleProjection]: "tuples",
  [Rule.Record]: "records", [Rule.RecordProjection]: "records", [Rule.CtRecord]: "records", [Rule.CtRecordProjection]: "records",
  [Rule.Nil]: "lists", [Rule.Cons]: "lists", [Rule.IsNil]: "lists", [Rule.Head]: "lists", [Rule.Tail]: "lists",
  [Rule.CtNil]: "lists", [Rule.CtCons]: "lists", [Rule.CtIsNil]: "lists", [Rule.CtHead]: "lists", [Rule.CtTail]: "lists",
};

export function rulesForTheories(theories: TypeTheoryConfig, features: StlcFeatureConfig = DEFAULT_STLC_FEATURES): Rule[] {
  if (theories.typedNbl) return [...TYPED_NBL_RULES];
  const usesConstraints = theories.letPolymorphism || theories.typeInference;
  return BUILDER_RULES.filter((rule) => {
    if (isCtRule(rule) && !usesConstraints) return false;
    const feature = RULE_FEATURE[rule];
    if (feature && !features[feature]) return false;
    const required = RULE_THEORY[rule];
    return !required || theories[required];
  });
}
