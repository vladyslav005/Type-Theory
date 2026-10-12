import type {InferProofTree, ProofTree} from "@vladyslav005/tt-core";
import {TexMapper} from "@vladyslav005/tt-core";

// C₁ of the lecture's generalize(C₁, Γ, x : T₁): the value premise's constraints.
export function valueConstraintsTex(value: ProofTree | undefined): string {
  const constraints = (value as InferProofTree | undefined)?.constraints ?? [];
  if (constraints.length === 0) return "\\emptyset";
  return `\\{ ${constraints.map((c) => `${TexMapper.typeToTex(c.left)} = ${TexMapper.typeToTex(c.right)}`).join(", ")} \\}`;
}
