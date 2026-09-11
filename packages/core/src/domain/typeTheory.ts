export type TypeTheoryId = "letPolymorphism" | "typeInference" | "systemF" | "systemFOmega" | "systemLambdaP" | "isoRecursiveTypes" | "untyped";

export interface TypeTheoryConfig {
  letPolymorphism: boolean;
  typeInference: boolean;
  systemF: boolean;
  systemFOmega: boolean;
  systemLambdaP: boolean;
  isoRecursiveTypes: boolean;
  untyped: boolean;
}

export const DEFAULT_TYPE_THEORY_CONFIG: TypeTheoryConfig = {
  letPolymorphism: false,
  typeInference: false,
  systemF: false,
  systemFOmega: false,
  systemLambdaP: false,
  isoRecursiveTypes: false,
  untyped: false,
};

// No extension on top of plain STLC — the Curry-Howard logic view only has a clean reading for this fragment.
export function isPlainStlc(theories: TypeTheoryConfig): boolean {
  return Object.values(theories).every((enabled) => !enabled);
}

export interface TypeTheoryDescriptor {
  id: TypeTheoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export const TYPE_THEORIES: TypeTheoryDescriptor[] = [
  {
    id: "letPolymorphism",
    label: "Let-polymorphism",
    shortLabel: "Let-poly",
    description: "Generalize let-bound values (Hindley-Milner) so they can be reused at different types",
  },
  {
    id: "typeInference",
    label: "Type inference",
    shortLabel: "Inference",
    description: "Allow omitting a lambda's parameter type anywhere; it's inferred from how the parameter is used (always allowed inside a let-bound value)",
  },
  {
    id: "isoRecursiveTypes",
    label: "Iso-recursive types (μ)",
    shortLabel: "μ-types",
    description: "Self-referential types (μX.T) introduced/eliminated explicitly via fold/unfold, isomorphic (not equal) to their one-step unfolding [X↦μX.T]T",
  },
  {
    id: "systemF",
    label: "System F",
    shortLabel: "System F",
    description: "Explicit polymorphism via type abstraction (ΛX. t) and type application (t [T])",
  },
  {
    id: "systemFOmega",
    label: "System Fω (type constructors)",
    shortLabel: "System Fω",
    description: "Types abstracted over types (λX:K. T) and applied to a type argument (F T), classified by kinds (K ::= * | K→K) instead of just types",
  },
  {
    id: "systemLambdaP",
    label: "System λP (dependent types)",
    shortLabel: "System λP",
    description: "Types that depend on terms via Π-types (Πx:A.M, of which A→B is the non-dependent special case), and kinds indexed by a type (K ::= * | T→K, e.g. Nat→*)",
  },
  {
    id: "untyped",
    label: "Untyped lambda calculus",
    shortLabel: "Untyped",
    description: "Only variables, abstraction, and application — everything else (type annotations, if/arithmetic/literals, tuples/records, fix) is rejected. Selecting it disables every other extension.",
  },
];
