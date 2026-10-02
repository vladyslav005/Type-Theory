import type {InferProofTree, ProofTree, Type, TypeScheme} from "@vladyslav005/tt-core";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";
import {expectedGeneralizedScheme, expectedNewBindings, type StudentProofNode} from "@/shared/ui-state/studentProof.ts";
import type {FeedbackMessage} from "./feedback.ts";
import {ruleFeedback} from "./ruleFeedback.ts";
import {constraintFeedback, typeFeedback, type VariableMatching} from "./typeFeedback.ts";

// Same flexibility as the semi-automatic checker: any name for an inference variable, used consistently.
function flexibleVariables(): VariableMatching {
  const expectedToWritten = new Map<string, string>();
  const writtenToExpected = new Map<string, string>();
  return {
    identifierAsVariable: true,
    bind: (written, expected) => {
      const mappedWritten = expectedToWritten.get(expected.name);
      const mappedExpected = writtenToExpected.get(written.name);
      if (mappedWritten !== undefined || mappedExpected !== undefined) {
        return mappedWritten === written.name && mappedExpected === expected.name;
      }
      expectedToWritten.set(expected.name, written.name);
      writtenToExpected.set(written.name, expected.name);
      return true;
    },
  };
}

const sameShape = (written: Type, expected: Type) =>
  typeFeedback(written, expected, flexibleVariables()).code === "feedback.typeInconsistent";

// Messages for a checked semi-automatic node, derived from its verdicts so they always match what is marked.
export function semiNodeFeedback(student: StudentProofNode, answer: ProofTree, parentGamma: Record<string, Type | TypeScheme>): FeedbackMessage[] {
  const messages: FeedbackMessage[] = [];
  if (student.ruleCheck === "invalid" && student.chosenRule !== undefined) {
    messages.push(ruleFeedback({rule: student.chosenRule}, RULE_LABELS[student.chosenRule] ?? student.chosenRule, answer));
  }
  if (student.contextCheck === "invalid" && student.writtenBindings) {
    const expected = expectedNewBindings(answer, parentGamma);
    const missing = expected.filter((e) => !student.writtenBindings!.some((w) => w.name === e.name));
    const extra = student.writtenBindings.filter((w) => !expected.some((e) => e.name === w.name));
    if (missing.length > 0) messages.push({code: "feedback.contextMissing"});
    if (extra.length > 0) messages.push({code: "feedback.contextExtra", params: {names: extra.map((b) => b.name).join(", ")}});
    for (const e of expected) {
      const w = student.writtenBindings.find((b) => b.name === e.name);
      if (w) {
        const message = typeFeedback(w.type, e.type, flexibleVariables(), "feedback.subject.binding");
        if (message.code !== "feedback.typeInconsistent") messages.push(message);
      }
    }
  }
  if (student.typeCheck === "invalid" && student.writtenType) {
    messages.push(typeFeedback(student.writtenType, answer.type, flexibleVariables()));
  }
  if (student.constraintCheck === "invalid" && student.writtenConstraints) {
    const expected = (answer as InferProofTree).constraints ?? [];
    messages.push(...constraintFeedback(student.writtenConstraints, expected, (w, e) => sameShape(w.left, e.left) && sameShape(w.right, e.right)));
  }
  return messages;
}

export function generalizeFeedback(student: StudentProofNode, letAnswer: ProofTree): FeedbackMessage[] {
  if (student.generalizeCheck !== "invalid" || !student.writtenScheme) return [];
  const expected = expectedGeneralizedScheme(letAnswer);
  return expected ? [typeFeedback(student.writtenScheme, expected, flexibleVariables(), "feedback.subject.scheme")] : [];
}
