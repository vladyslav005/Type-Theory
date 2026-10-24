import type {Term} from "@/domain/ast";

// nv ::= 0 | succ nv — STLC's Nat literals 1, 2, … count as numeric values too.
export function isNumericValue(term: Term): boolean {
  return numeralOf(term) !== undefined;
}

// succ (succ 2) is the number 4; undefined for anything that isn't a numeric value.
export function numeralOf(term: Term): number | undefined {
  if (term.kind === "Lit") return /^\d+$/.test(term.value) ? Number(term.value) : undefined;
  if (term.kind !== "Succ") return undefined;
  const inner = numeralOf(term.term);
  return inner === undefined ? undefined : inner + 1;
}
