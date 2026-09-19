import type {ProofTree, GammaRegistry} from "@vladyslav005/tt-core";
import {Rule, TexMapper} from "@vladyslav005/tt-core";
import type {StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import {gammaRefTex} from "@/features/proof-tree/components/proof-tree-builder/ConclusionBuilder.tsx";

// The type is the student's own answer (or "?"), never the answer key's — the leaf must not give
// away what they haven't written yet.
export function variableMembershipJudgement(
  studentNode: StudentProofNode,
  answerNode: ProofTree,
  registry: GammaRegistry,
): string {
  const name = (answerNode.term as {name?: string}).name ?? "?";
  const gammaTex = gammaRefTex(answerNode.gamma, registry, false);
  const answered = studentNode.writtenType !== undefined;

  if (answerNode.rule === Rule.CtVarLet) {
    const scheme = answerNode.gamma[name];
    const schemeTex = answered && scheme !== undefined ? TexMapper.typeToTex(scheme) : "?";
    return `\\mathit{instantiate}(${name} : ${schemeTex} \\in ${gammaTex})`;
  }

  const typeTex = studentNode.writtenType ? TexMapper.typeToTex(studentNode.writtenType) : "?";
  return `${name} : ${typeTex} \\in ${gammaTex}`;
}
