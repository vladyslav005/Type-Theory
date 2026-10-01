import type {Term} from "@/domain/ast";

// nv ::= 0 | succ nv
export function isNumericValue(term: Term): boolean {
  if (term.kind === "Lit") return term.value === "0";
  return term.kind === "Succ" && isNumericValue(term.term);
}
