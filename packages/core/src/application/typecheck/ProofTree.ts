import type {Kind, SourcePosition, Term, Type, TyIdentifier} from "@/domain/ast";

export interface ProofTree {
  rule: Rule
  premises: ProofTree[]
  id?: string
  term: Term
  type: Type
  gamma: Record<string, Type | TypeScheme>
  error?: string
  // Kind derivation (Δ, Γ ⊢ T : K) for this node's type, only set when the type mentions a λω̲ constructor.
  kindPremise?: KindProofTree
  // The (Conv) rule made visible, set only when the annotation needed a β-reduction to normal form.
  typeConversion?: TypeConversion
}

export interface TypeConversion {
  before: Type;
  after: Type;
}

// A kinding derivation Δ, Γ ⊢ subject : resultKind — the λω̲ analogue of ProofTree, for Types rather
// than Terms. Δ and Γ are rendered as one ordered context (type variables before term variables),
// matching the unified-context PTS presentation the lecture uses.
export interface KindProofTree {
  rule: Rule
  premises: KindProofTree[]
  // K-IndexApp's second premise (Γ ⊢ t : A) is a term-typing fact about the index, not a kinding one.
  indexPremise?: ProofTree
  id?: string
  subject: Type
  resultKind: Kind
  delta: Record<string, Kind>
  gamma: Record<string, Type | TypeScheme>
  error?: string
}

export interface Constraint {
  left: Type;
  right: Type;
  pos?: SourcePosition;
}

export type Substitution = Map<string, Type>;

export interface TypeScheme {
  kind: "TypeScheme";
  vars: string[];
  type: Type;
}

export interface InferProofTree extends ProofTree {
  constraints: Constraint[];
}

export enum Rule {
  Var = "Var",
  Abs = "Abs",
  App = "App",
  Lit = "Lit",
  If = "If",
  Inl = "Inl",
  Inr = "Inr",
  Case = "Case",
  VariantCase = "VariantCase",
  Variant = "Variant",
  Ascribe = "Ascribe",
  Tuple = "Tuple",
  TupleProjection = "TupleProjection",
  Record = "Record",
  RecordProjection = "RecordProjection",
  Sequencing = "Sequencing",
  DummyAbs = "DummyAbs",
  Let = "Let",
  // Single tag for all arithmetic/comparison operators — the operator on
  // the term itself picks the displayed rule name (T-Plus, T-Lt, ...).
  BinOp = "BinOp",
  Fix = "Fix",

  // Lists (Lecture 06).
  Nil = "Nil",
  Cons = "Cons",
  IsNil = "IsNil",
  Head = "Head",
  Tail = "Tail",

  // Iso-recursive types (Lecture 06).
  Fold = "Fold",
  Unfold = "Unfold",

  // System F is syntax-directed, so it always gets plain (non-Ct) rule names, even inside a `let`.
  TypeAbs = "TypeAbs",
  TypeApp = "TypeApp",

  // Unreachable in practice — kept only so AstVisitor's dispatch stays exhaustive.
  TyConstructorAbs = "TyConstructorAbs",
  TyConstructorApp = "TyConstructorApp",

  // System λP: applying a Π-typed function — distinct from ordinary App
  // because the result type is the body with the argument substituted in,
  // not a plain arrow's codomain.
  TPiApp = "TPiApp",

  // The kinding judgment (Δ ⊢ T :: K) — rendered on KindProofTree nodes,
  // attached to a term-level node via ProofTree.kindPremise.
  KindBase = "KindBase",
  KindVar = "KindVar",
  KindForm = "KindForm",
  KindForall = "KindForall",
  KindAbs = "KindAbs",
  KindApp = "KindApp",
  // System λP kinding rules: Π-type formation, and applying a dependently-
  // kinded type constructor to a term index.
  KindPi = "KindPi",
  KindIndexApp = "KindIndexApp",
  // μX.T is well-kinded (*) whenever T is, with X:* bound for the duration.
  KindMu = "KindMu",
  // The (Conv) rule made visible — see ProofTree.typeConversion.
  Conv = "Conv",

  CtVarLet = "CtVarLet",
  CtVar = "CtVar",
  CtAbs = "CtAbs",
  // λx.t with no parameter annotation — the parameter's type is a fresh
  // metavariable rather than a rigid, given one (CtAbs).
  CtAbsInf = "CtAbsInf",
  CtApp = "CtApp",
  CtLit = "CtLit",
  CtIf = "CtIf",
  CtInl = "CtInl",
  CtInr = "CtInr",
  CtCase = "CtCase",
  CtVariantCase = "CtVariantCase",
  CtVariant = "CtVariant",
  CtAscribe = "CtAscribe",
  CtTuple = "CtTuple",
  CtTupleProjection = "CtTupleProjection",
  CtRecord = "CtRecord",
  CtRecordProjection = "CtRecordProjection",
  CtSequencing = "CtSequencing",
  CtDummyAbs = "CtDummyAbs",
  CtLet = "CtLet",
  CtBinOp = "CtBinOp",
  CtFix = "CtFix",
  CtNil = "CtNil",
  CtCons = "CtCons",
  CtIsNil = "CtIsNil",
  CtHead = "CtHead",
  CtTail = "CtTail",
  CtFold = "CtFold",
  CtUnfold = "CtUnfold",
}

// Sentinel type used as a placeholder when the real type cannot be inferred due to an error.
export const ERROR_TYPE: TyIdentifier = { kind: "TyIdentifier", id: "error-sentinel", name: "?" };

// Placeholder "type" for Var/Abs/App under the Untyped lambda calculus theory, which has no
// type system at all — never fed into unification, just a stand-in so ProofTree.type is total.
export const UNTYPED_TYPE: TyIdentifier = { kind: "TyIdentifier", id: "untyped-sentinel", name: "Untyped" };


