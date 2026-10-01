import type {Node} from "@/domain/ast/node.ts";
import type {Type} from "@/domain/ast/type.ts";

export type Term =
  Var |
  Abs |
  App |
  Lit |
  VariantCase |
  Inl |
  Inr |
  IfCondition |
  Case |
  Variant |
  Ascribe |
  TupleProjection |
  RecordProjection |
  Record |
  Sequencing |
  Tuple |
  DummyAbstraction |
  Let |
  BinOp |
  TypeAbs |
  TypeApp |
  Fix |
  Nil |
  Cons |
  IsNil |
  Head |
  Tail |
  Fold |
  Unfold |
  Succ |
  Pred |
  IsZero

export interface Var extends Node {
  kind: "Var"
  name: string
}

export interface Abs extends Node {
  kind: "Abs"
  param: string
  // Omitted for an unannotated parameter (λx. t) — only legal inside a `let`-bound value, where it's inferred.
  paramType?: Type
  body: Term
  type?: Type
}

export interface App extends Node {
  kind: "App"
  func: Term
  arg: Term
}

export interface Lit extends Node {
  kind: "Lit"
  value: string
}

export interface VariantCase extends Node {
  kind: "VariantCase"
  variable: Term
  cases: {
    label: string
    variable: string
    body: Term
  }[]
}

export interface Inl extends Node {
  kind: "Inl"
  term: Term
  type: Type
}

export interface Inr extends Node {
  kind: "Inr"
  term: Term
  type: Type
}

export interface IfCondition extends Node {
  kind: "IfCondition"
  condition: Term
  then: Term
  elif?: {
    condition: Term
    then: Term
  }[]
  else?: Term
}

// Binary case
export interface Case extends Node {
  kind: "Case"
  variable: Term
  inl: {
    variable: string
    term: Term
  }
  inr: {
    variable: string
    term: Term
  }
}

export interface Variant extends Node {
  kind: "Variant"
  type: Type
  variants: {
    label: string
    term: Term
  }[]
}

export interface Ascribe extends Node {
  kind: "Ascribe"
  term: Term
  type: Type
}

export interface TupleProjection extends Node {
  kind: "TupleProjection"
  tuple: Term
  index: number
}

export interface RecordProjection extends Node {
  kind: "RecordProjection"
  term: Term
  label: string
}

export interface Record extends Node {
  kind: "Record"
  fields: {
    label: string
    term: Term
  }[]
}

export interface Sequencing extends Node {
  kind: "Sequencing"
  first: Term
  second: Term
}

export interface Tuple extends Node {
  kind: "Tuple"
  elements: Term[]
}

export interface DummyAbstraction extends Node {
  kind: "DummyAbstraction"
  paramType: Type
  body: Term
  type?: Type
}

// =====================================================================
// =                        LET POLYMORPHISM                           =
// =====================================================================

export interface Let extends Node {
  kind: "Let";
  name: string;
  value: Term;
  body: Term;
}

// =====================================================================
// =                    ARITHMETIC AND COMPARISON                      =
// =====================================================================

// Arithmetic and comparison operators share a single AST node/visitor
// method — the operator alone selects the typing rule, evaluation
// behaviour, and displayed proof-tree rule name.
export type BinaryOperator = "+" | "-" | "*" | "/" | "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface BinOp extends Node {
  kind: "BinOp";
  operator: BinaryOperator;
  left: Term;
  right: Term;
}

// =====================================================================
// =                        FIXPOINT OPERATOR                          =
// =====================================================================

export interface Fix extends Node {
  kind: "Fix";
  term: Term;
}

// =====================================================================
// =                        SYSTEM F                                   =
// =====================================================================

export interface TypeAbs extends Node {
  kind: "TypeAbs";
  typeParam: string;
  body: Term;
}

export interface TypeApp extends Node {
  kind: "TypeApp";
  term: Term;
  typeArg: Type;
}

// =====================================================================
// =                        LISTS (Lecture 06)                         =
// =====================================================================

export interface Nil extends Node {
  kind: "Nil";
  type: Type;
}

export interface Cons extends Node {
  kind: "Cons";
  type: Type;
  head: Term;
  tail: Term;
}

export interface IsNil extends Node {
  kind: "IsNil";
  type: Type;
  term: Term;
}

export interface Head extends Node {
  kind: "Head";
  type: Type;
  term: Term;
}

export interface Tail extends Node {
  kind: "Tail";
  type: Type;
  term: Term;
}

// =====================================================================
// =                 ISO-RECURSIVE TYPES (Lecture 06)                  =
// =====================================================================

// fold_{μX.T} t : μX.T — witnesses [X↦μX.T]T ≅ μX.T going "into" the recursive type.
export interface Fold extends Node {
  kind: "Fold";
  type: Type;
  term: Term;
}

// unfold_{μX.T} t : [X↦μX.T]T — the inverse direction of fold.
export interface Unfold extends Node {
  kind: "Unfold";
  type: Type;
  term: Term;
}

// =====================================================================
// =                 NUMBERS AND BOOLEANS (NBL, TAPL ch. 3)            =
// =====================================================================

export interface Succ extends Node {
  kind: "Succ";
  term: Term;
}

export interface Pred extends Node {
  kind: "Pred";
  term: Term;
}

export interface IsZero extends Node {
  kind: "IsZero";
  term: Term;
}
