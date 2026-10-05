import type {StlcFeatureConfig, TypeTheoryConfig} from "@vladyslav005/tt-core";

const STLC_CORE = [
  "abstraction", "application", "variable", "literal", "ifCondition", "dummyAbstraction", "sequencing", "ascribe", "binOp", "fix",
  "typeVar", "typeArrow",
  "funDecl", "varDecl", "typeAliasDecl",
];

const BY_FEATURE: Record<keyof StlcFeatureConfig, string[]> = {
  sums: ["inl", "inr", "case", "variant", "variantCase", "sumType", "variantType"],
  tuples: ["tuple", "tupleProjection", "tupleType"],
  records: ["record", "recordProjection", "recordType"],
  lists: ["nil", "cons", "isNil", "headOp", "tailOp", "listType"],
};

const BY_EXTENSION: Partial<Record<keyof TypeTheoryConfig, string[]>> = {
  letPolymorphism: ["let"],
  isoRecursiveTypes: ["fold", "unfold", "recursiveType"],
  systemF: ["typeAbs", "typeApp", "forallType"],
  systemFOmega: ["typeConstructorAbs", "typeConstructorApp", "kindStar", "kindArrow"],
  systemLambdaP: ["typePi", "typeIndexApp", "kindStar", "kindArrow"],
};

// The AST node types the current Language menu choice can actually use, for the editor's palette.
export function languageNodeTypes(theories: TypeTheoryConfig, features: StlcFeatureConfig): string[] {
  if (theories.nbl || theories.typedNbl) return ["literal", "ifCondition", "succ", "pred", "iszero"];
  if (theories.untyped) return ["abstraction", "application", "variable", "funDecl"];
  const types = new Set(STLC_CORE);
  (Object.keys(BY_FEATURE) as (keyof StlcFeatureConfig)[]).forEach((feature) => features[feature] && BY_FEATURE[feature].forEach((type) => types.add(type)));
  (Object.keys(BY_EXTENSION) as (keyof TypeTheoryConfig)[]).forEach((theory) => theories[theory] && BY_EXTENSION[theory]?.forEach((type) => types.add(type)));
  return [...types];
}
