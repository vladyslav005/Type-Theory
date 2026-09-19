import type {ProofTree, TypeScheme} from "@vladyslav005/tt-core";
import type {Type} from "@vladyslav005/tt-core";
import type {StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import type {GammaRegistry} from "@vladyslav005/tt-core";
import type {ExportTree} from "@vladyslav005/tt-core";
import {TexMapper} from "@vladyslav005/tt-core";
import {gammaRefTex} from "@/features/proof-tree/components/proof-tree-builder/ConclusionBuilder.tsx";
import {variableMembershipJudgement} from "@/features/proof-tree/components/proof-tree-builder/variableMembership.ts";
import {isVarRule} from "@/shared/ui-state/ruleFamilies.ts";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";

export interface StudentExportOptions {
  // Keys currently expanded in the browser, `${studentNode.id}:gamma` per
  // ConclusionBuilder's gammaKey — checked directly rather than through the
  // segment-index scheme the automatic/logic trees use, since a builder
  // node's judgement is one hand-assembled string, not a TexSegment[].
  expandedKeys: ReadonlySet<string>;
  highlightMistakes: boolean;
}

// A local variable's Γ membership is a given fact — mirrors
// ProofTreeBuilderNode's VariableMembershipLeaf.
function variableMembershipLeaf(studentNode: StudentProofNode, answerNode: ProofTree, registry: GammaRegistry): ExportTree {
  return {judgement: variableMembershipJudgement(studentNode, answerNode, registry), rule: ""};
}

// Converts the student's in-progress (studentNode, answerNode) pair into a
// TexTree snapshot of exactly what's currently on screen: only revealed
// premises, "?" for anything not yet filled in, and — when requested — the
// same green/red correctness highlighting as the "Highlight mistakes" toggle.
export function studentNodeToExportTree(
  studentNode: StudentProofNode,
  answerNode: ProofTree,
  parentGamma: Record<string, Type | TypeScheme>,
  registry: GammaRegistry,
  opts: StudentExportOptions,
): ExportTree {
  const hasChosenRule = studentNode.chosenRule !== undefined;
  const isLocalVar = hasChosenRule && isVarRule(answerNode.rule) && answerNode.premises.length === 0;

  const gammaKey = `${studentNode.id}:gamma`;
  const gammaExpanded = opts.expandedKeys.has(gammaKey);

  const termTex = TexMapper.termToTex(answerNode.term);
  const rhsTex = studentNode.writtenType ? TexMapper.typeToTex(studentNode.writtenType) : "?";
  const bindingTex = studentNode.writtenBindings?.length
    ? studentNode.writtenBindings.map((b) => `${b.name}:${TexMapper.typeToTex(b.type)}`).join(", ")
    : "?";

  const parentGammaRef = registry.refFor(parentGamma);
  const parentGammaTex = parentGammaRef ? gammaRefTex(parentGamma, registry, gammaExpanded) : null;
  const bindingSetTex = `\\{${bindingTex}\\}`;

  const gammaSegment = studentNode.requiresContextBuild
    ? (parentGammaTex ? `${parentGammaTex} \\cup ${bindingSetTex}` : bindingSetTex)
    : gammaRefTex(answerNode.gamma, registry, gammaExpanded);

  const constraintsTex = studentNode.writtenConstraints === undefined
    ? "?"
    : studentNode.writtenConstraints.length === 0
      ? "\\emptyset"
      : `\\{ ${studentNode.writtenConstraints.map((c) => `${TexMapper.typeToTex(c.left)} = ${TexMapper.typeToTex(c.right)}`).join(", ")} \\}`;
  const constraintsSegment = studentNode.requiresConstraints ? ` \\mid ${constraintsTex}` : "";
  const judgement = `${gammaSegment} \\vdash ${termTex} : ${rhsTex}${constraintsSegment}`;
  const ruleLabel = hasChosenRule ? (RULE_LABELS[studentNode.chosenRule!] ?? "?") : "pick rule";

  const anyInvalid = studentNode.ruleCheck === "invalid"
    || studentNode.typeCheck === "invalid"
    || studentNode.contextCheck === "invalid"
    || studentNode.constraintCheck === "invalid";
  const allValid = studentNode.ruleCheck === "valid"
    && studentNode.typeCheck === "valid"
    && (!studentNode.requiresContextBuild || studentNode.contextCheck === "valid")
    && (!studentNode.requiresConstraints || studentNode.constraintCheck === "valid");
  const highlight: ExportTree["highlight"] = !opts.highlightMistakes
    ? undefined
    : anyInvalid ? "invalid" : allValid ? "valid" : undefined;

  if (isLocalVar) {
    return {
      judgement,
      rule: ruleLabel,
      id: studentNode.id,
      highlight,
      children: [variableMembershipLeaf(studentNode, answerNode, registry)],
    };
  }

  if (!hasChosenRule) {
    return {judgement, rule: ruleLabel, id: studentNode.id, highlight};
  }

  // Original index, not position in the filtered list — premises can be
  // revealed out of order (mirrors ProofTreeBuilderNode's premisesToShow).
  const children: ExportTree[] = [];
  studentNode.premises.forEach((premise, index) => {
    const answer = answerNode.premises[index];
    if (!premise.revealed || answer === undefined) return;
    const childParentGamma = isVarRule(answerNode.rule) ? answer.gamma : answerNode.gamma;
    children.push(studentNodeToExportTree(premise, answer, childParentGamma, registry, opts));
    if (index === 0 && studentNode.requiresGeneralize) {
      const valueTex = premise.writtenType ? TexMapper.typeToTex(premise.writtenType) : "?";
      const schemeTex = studentNode.writtenScheme ? TexMapper.typeToTex(studentNode.writtenScheme) : "?";
      children.push({
        judgement: `\\mathit{generalize}(${valueTex}, ${Object.keys(answerNode.gamma).length > 0 ? gammaRefTex(answerNode.gamma, registry, gammaExpanded) : "\\Gamma"}) = ${schemeTex}`,
        rule: "",
      });
    }
  });

  return {judgement, rule: ruleLabel, id: studentNode.id, highlight, children};
}
