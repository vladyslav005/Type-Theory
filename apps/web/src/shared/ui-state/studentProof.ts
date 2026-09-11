import {type ProofTree, Rule, type TypeScheme} from "@vladyslav005/tt-core";
import type {Type} from "@vladyslav005/tt-core";
import {termIndexEquals, TexMapper} from "@vladyslav005/tt-core";

export interface ContextBinding {
  name: string;
  type: Type;
}

// The student's in-progress manual derivation for "Build & Check" mode. Mirrors the frozen
// answer-key ProofTree 1:1 — only rule/type content is filled in, never the tree structure.
export interface StudentProofNode {
  id: string;
  // Revealed by clicking the corresponding sub-term (see ConclusionBuilder).
  revealed: boolean;
  chosenRule?: Rule;
  // Only stamped by Check Proof — a wrong pick doesn't block the exercise.
  ruleCheck?: "valid" | "invalid";
  writtenType?: Type;
  typeCheck?: "valid" | "invalid";
  // True when this node's real Γ adds a binding on top of its parent's.
  requiresContextBuild?: boolean;
  writtenBindings?: ContextBinding[];
  contextCheck?: "valid" | "invalid";
  premises: StudentProofNode[];
}

// A key present in both gammas but bound to a different type (shadowing) still counts as
// "new" — comparing by name alone would miss a rebound variable entirely.
function isRebound(name: string, value: Type | TypeScheme, parentGamma: Record<string, Type | TypeScheme>): boolean {
  return !(name in parentGamma) || TexMapper.typeToTex(value) !== TexMapper.typeToTex(parentGamma[name]);
}

export function buildStudentNode(
  answer: ProofTree,
  revealed: boolean,
  parentGamma: Record<string, Type | TypeScheme> = answer.gamma,
): StudentProofNode {
  const requiresContextBuild = Object.entries(answer.gamma).some(([k, v]) => isRebound(k, v, parentGamma));
  // A T-Var's "jump to definition" premise has its own unrelated scope.
  const childParentGamma = (p: ProofTree) => answer.rule === Rule.Var ? p.gamma : answer.gamma;
  return {
    id: answer.id ?? crypto.randomUUID(),
    revealed,
    requiresContextBuild: requiresContextBuild || undefined,
    premises: answer.premises.map((p) => buildStudentNode(p, false, childParentGamma(p))),
  };
}

export function findStudentNode(root: StudentProofNode, id: string): StudentProofNode | undefined {
  if (root.id === id) return root;
  for (const premise of root.premises) {
    const found = findStudentNode(premise, id);
    if (found) return found;
  }
  return undefined;
}

function bindingsMatch(written: ContextBinding[], expected: ContextBinding[]): boolean {
  if (written.length !== expected.length) return false;
  return expected.every((e) => written.some((w) => w.name === e.name && flexibleTypeEquals(w.type, e.type)));
}

// Converts a Let-generalized TypeScheme into a Type a student can actually write: nested ∀'s
// wrapping the (still metavar-laden) body — flexibleTypeEquals treats every TyMetaVar as a
// flexible position regardless of name, so no renaming is needed here, only the ∀ structure
// itself, which forces the student's answer to be recognizably a polymorphic scheme.
function typeSchemeToDisplayType(scheme: TypeScheme): Type {
  return scheme.vars.reduceRight(
    (acc, v): Type => ({kind: "TyForall", id: crypto.randomUUID(), typeVariable: v, type: acc}),
    scheme.type,
  );
}

// Structural type equality that also treats any TyMetaVar — an unresolved/free type variable,
// e.g. an unannotated lambda's own parameter before an enclosing `let` generalizes it — as a
// flexible position: the student may write any identifier there, as long as they use the SAME
// one everywhere the same metavariable recurs (tracked via a pair of consistent rename maps).
// The exact letter the checker's fresh-variable counter or generalize() happened to pick is an
// internal implementation detail, never something a student could know or reasonably guess.
// Degrades to plain structural typeEquals when neither side involves a variable at all.
function flexibleTypeEquals(
  written: Type,
  expected: Type,
  expToWritten: Map<string, string> = new Map(),
  writtenToExp: Map<string, string> = new Map(),
): boolean {
  if (expected.kind === "TyMetaVar") {
    if (written.kind !== "TyIdentifier" && written.kind !== "TyMetaVar") return false;
    const mappedWritten = expToWritten.get(expected.name);
    const mappedExpected = writtenToExp.get(written.name);
    if (mappedWritten !== undefined || mappedExpected !== undefined) {
      return mappedWritten === written.name && mappedExpected === expected.name;
    }
    expToWritten.set(expected.name, written.name);
    writtenToExp.set(written.name, expected.name);
    return true;
  }

  if (written.kind !== expected.kind) return false;

  switch (expected.kind) {
    case "TyIdentifier":
      return written.kind === "TyIdentifier" && written.name === expected.name;

    case "TyArrow": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.from, expected.from, expToWritten, writtenToExp)
        && flexibleTypeEquals(w.to, expected.to, expToWritten, writtenToExp);
    }

    case "TupleType": {
      const wElements = (written as typeof expected).elements;
      return wElements.length === expected.elements.length
        && expected.elements.every((e, i) => flexibleTypeEquals(wElements[i], e, expToWritten, writtenToExp));
    }

    case "SumType": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.left, expected.left, expToWritten, writtenToExp)
        && flexibleTypeEquals(w.right, expected.right, expToWritten, writtenToExp);
    }

    case "VariantType": {
      const wVariants = (written as typeof expected).variants;
      if (wVariants.length !== expected.variants.length) return false;
      return expected.variants.every((v) => {
        const match = wVariants.find((wv) => wv.label === v.label);
        return match !== undefined && flexibleTypeEquals(match.type, v.type, expToWritten, writtenToExp);
      });
    }

    case "RecordType": {
      const wFields = (written as typeof expected).fields;
      if (wFields.length !== expected.fields.length) return false;
      return expected.fields.every((f) => {
        const match = wFields.find((wf) => wf.label === f.label);
        return match !== undefined && flexibleTypeEquals(match.type, f.type, expToWritten, writtenToExp);
      });
    }

    case "TyForall": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.type, expected.type, expToWritten, writtenToExp);
    }

    case "TyConstructorAbs": {
      const w = written as typeof expected;
      return w.typeParam === expected.typeParam && flexibleTypeEquals(w.body, expected.body, expToWritten, writtenToExp);
    }

    case "TyConstructorApp": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.func, expected.func, expToWritten, writtenToExp)
        && flexibleTypeEquals(w.arg, expected.arg, expToWritten, writtenToExp);
    }

    case "TyPi": {
      const w = written as typeof expected;
      return w.paramVar === expected.paramVar
        && flexibleTypeEquals(w.paramType, expected.paramType, expToWritten, writtenToExp)
        && flexibleTypeEquals(w.body, expected.body, expToWritten, writtenToExp);
    }

    case "TyIndexApp": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.func, expected.func, expToWritten, writtenToExp) && termIndexEquals(w.arg, expected.arg);
    }

    case "ListType": {
      const w = written as typeof expected;
      return flexibleTypeEquals(w.elementType, expected.elementType, expToWritten, writtenToExp);
    }

    case "RecursiveType": {
      const w = written as typeof expected;
      return w.typeVariable === expected.typeVariable && flexibleTypeEquals(w.type, expected.type, expToWritten, writtenToExp);
    }
  }
}

// Maps each constraint-mode (Ct*) rule to its plain equivalent, since the rule picker only offers
// plain ones — comparisons must normalize both sides first.
const CT_TO_PLAIN_RULE: Partial<Record<Rule, Rule>> = {
  [Rule.CtVarLet]: Rule.Var,
  [Rule.CtVar]: Rule.Var,
  [Rule.CtAbs]: Rule.Abs,
  [Rule.CtAbsInf]: Rule.Abs,
  [Rule.CtApp]: Rule.App,
  [Rule.CtLit]: Rule.Lit,
  [Rule.CtIf]: Rule.If,
  [Rule.CtInl]: Rule.Inl,
  [Rule.CtInr]: Rule.Inr,
  [Rule.CtCase]: Rule.Case,
  [Rule.CtVariantCase]: Rule.VariantCase,
  [Rule.CtVariant]: Rule.Variant,
  [Rule.CtAscribe]: Rule.Ascribe,
  [Rule.CtTuple]: Rule.Tuple,
  [Rule.CtTupleProjection]: Rule.TupleProjection,
  [Rule.CtRecord]: Rule.Record,
  [Rule.CtRecordProjection]: Rule.RecordProjection,
  [Rule.CtSequencing]: Rule.Sequencing,
  [Rule.CtDummyAbs]: Rule.DummyAbs,
  [Rule.CtLet]: Rule.Let,
  [Rule.CtBinOp]: Rule.BinOp,
  [Rule.CtFix]: Rule.Fix,
  [Rule.CtNil]: Rule.Nil,
  [Rule.CtCons]: Rule.Cons,
  [Rule.CtIsNil]: Rule.IsNil,
  [Rule.CtHead]: Rule.Head,
  [Rule.CtTail]: Rule.Tail,
  [Rule.CtFold]: Rule.Fold,
  [Rule.CtUnfold]: Rule.Unfold,
};

function canonicalRule(rule: Rule): Rule {
  return CT_TO_PLAIN_RULE[rule] ?? rule;
}

// Diffs filled-in nodes against the answer key, stamping ruleCheck/typeCheck/
// contextCheck independently — unreached nodes are left untouched.
export function diffAgainstAnswer(
  student: StudentProofNode,
  answer: ProofTree,
  parentGamma: Record<string, Type | TypeScheme> = answer.gamma,
): void {
  if (student.chosenRule !== undefined) {
    student.ruleCheck = canonicalRule(student.chosenRule) === canonicalRule(answer.rule) ? "valid" : "invalid";
  }
  if (student.chosenRule !== undefined && student.writtenType !== undefined) {
    student.typeCheck = flexibleTypeEquals(student.writtenType, answer.type) ? "valid" : "invalid";
  }
  if (student.requiresContextBuild && student.writtenBindings !== undefined) {
    const expected: ContextBinding[] = Object.entries(answer.gamma)
      .filter(([k, v]) => isRebound(k, v, parentGamma))
      .map(([k, bound]) => {
        const type = bound.kind === "TypeScheme" ? typeSchemeToDisplayType(bound) : bound;
        return {name: k, type};
      });
    student.contextCheck = bindingsMatch(student.writtenBindings, expected) ? "valid" : "invalid";
  }
  student.premises.forEach((premise, index) => {
    const answerPremise = answer.premises[index];
    if (!answerPremise) return;
    const childParentGamma = answer.rule === Rule.Var ? answerPremise.gamma : answer.gamma;
    diffAgainstAnswer(premise, answerPremise, childParentGamma);
  });
}

export interface ProofBuildSummary {
  total: number;
  filled: number;
  valid: number;
  invalid: number;
}

// Node counts for the "Check Proof" summary strip.
export function summarizeStudentTree(node: StudentProofNode): ProofBuildSummary {
  const children = node.premises.map(summarizeStudentTree);
  const sum = (pick: (s: ProofBuildSummary) => number) => children.reduce((n, s) => n + pick(s), 0);

  const contextFilled = !node.requiresContextBuild || node.writtenBindings !== undefined;
  const contextOk = !node.requiresContextBuild || node.contextCheck !== "invalid";
  const isFilled = node.chosenRule !== undefined && node.writtenType !== undefined && contextFilled;
  const isValid = node.ruleCheck === "valid" && node.typeCheck === "valid" && contextOk;
  const isInvalid = node.ruleCheck === "invalid"
    || node.typeCheck === "invalid"
    || (node.requiresContextBuild && node.contextCheck === "invalid");

  return {
    total: 1 + sum((s) => s.total),
    filled: (isFilled ? 1 : 0) + sum((s) => s.filled),
    valid: (isValid ? 1 : 0) + sum((s) => s.valid),
    invalid: (isInvalid ? 1 : 0) + sum((s) => s.invalid),
  };
}

// Build & Check requires the term to already type-check.
export function countProofErrors(proof: ProofTree): number {
  return (proof.error ? 1 : 0) + proof.premises.reduce((n, p) => n + countProofErrors(p), 0);
}
