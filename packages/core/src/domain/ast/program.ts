import type {GlobalDecl} from "@/domain/ast";
import type {Term} from "@/domain/ast/term.ts";
import type {Node} from "@/domain/ast/node.ts";
import type {Type} from "@/domain/ast/type.ts";

export interface Program extends Node {
  kind: "Program"
  globals: GlobalDecl[]
  term?: Term
  // The main expression's stated type (`term : T;`), checked against its inferred type.
  termType?: Type
}
