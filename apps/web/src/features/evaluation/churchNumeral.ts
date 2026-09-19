import type {Term} from "@vladyslav005/tt-core";

// λs. λz. s (s (... z)) — n applications of s to z reads as the number n.
export function churchNumeralValue(term: Term): number | null {
  if (term.kind !== "Abs" || term.body.kind !== "Abs") return null;
  const succ = term.param;
  const zero = term.body.param;
  if (succ === zero) return null;

  let count = 0;
  let body: Term = term.body.body;
  while (body.kind === "App" && body.func.kind === "Var" && body.func.name === succ) {
    count += 1;
    body = body.arg;
  }
  return body.kind === "Var" && body.name === zero ? count : null;
}
