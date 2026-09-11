import type {Type} from "@/domain/ast/type.ts";
import type {Term} from "@/domain/ast/term.ts";
import type {Node} from "@/domain/ast/node.ts";
import type {Kind} from "@/domain/ast/kind.ts";

export type GlobalDecl = VarDecl | FunDecl | TypeAliasDecl | TypeConstructorDecl

export interface VarDecl extends Node {
  kind: "VarDecl"
  name: string
  type: Type
  value: Term
}

export interface FunDecl extends Node {
  kind: "FunDecl"
  name: string
  value: Term
  type?: Type

}

// typedef X = T; — a transparent synonym, expanded to T during typechecking. No runtime value.
export interface TypeAliasDecl extends Node {
  kind: "TypeAliasDecl"
  name: string
  type: Type
}

// typedef X : K; — declares X as an opaque type constructor (e.g. "Vec : Nat -> *") with no definition.
export interface TypeConstructorDecl extends Node {
  kind: "TypeConstructorDecl"
  name: string
  paramKind: Kind
}
