import {typeToString, type Type} from "@vladyslav005/tt-core";
import {translatedParam, type FeedbackMessage} from "./feedback.ts";

type MetaVar = Extract<Type, {kind: "TyMetaVar"}>;

export interface VariableMatching {
  // Semi-automatic accepts any identifier for an inference variable; the manual builder requires 'A.
  identifierAsVariable: boolean;
  bind: (written: Type & {name: string}, expected: MetaVar) => boolean;
}

type Difference = {at: Type; reason: "kind"; expectedKind: string} | {at: Type; reason: "value" | "arity" | "labels" | "variable"};


function difference(written: Type, expected: Type, vars: VariableMatching): Difference | null {
  if (expected.kind === "TyMetaVar") {
    const acceptable = written.kind === "TyMetaVar" || (vars.identifierAsVariable && written.kind === "TyIdentifier");
    if (!acceptable) return {at: written, reason: "kind", expectedKind: "TyMetaVar"};
    return vars.bind(written as Type & {name: string}, expected) ? null : {at: written, reason: "variable"};
  }
  if (written.kind !== expected.kind) return {at: written, reason: "kind", expectedKind: expected.kind};
  const w = written as never as Record<string, unknown>;
  switch (expected.kind) {
    case "TyIdentifier":
      return (written as typeof expected).name === expected.name ? null : {at: written, reason: "value"};
    case "TyArrow": {
      const arrow = written as typeof expected;
      return difference(arrow.from, expected.from, vars) ?? difference(arrow.to, expected.to, vars);
    }
    case "SumType": {
      const sum = written as typeof expected;
      return difference(sum.left, expected.left, vars) ?? difference(sum.right, expected.right, vars);
    }
    case "ListType":
      return difference((written as typeof expected).elementType, expected.elementType, vars);
    case "TyForall":
      return difference((written as typeof expected).type, expected.type, vars);
    case "TupleType": {
      const elements = (written as typeof expected).elements;
      if (elements.length !== expected.elements.length) return {at: written, reason: "arity"};
      for (let i = 0; i < elements.length; i += 1) {
        const found = difference(elements[i], expected.elements[i], vars);
        if (found) return found;
      }
      return null;
    }
    case "RecordType":
    case "VariantType": {
      const key = expected.kind === "RecordType" ? "fields" : "variants";
      const mine = w[key] as {label: string; type: Type}[];
      const theirs = (expected as never as Record<string, unknown>)[key] as {label: string; type: Type}[];
      const sameLabels = mine.length === theirs.length && theirs.every((e) => mine.some((m) => m.label === e.label));
      if (!sameLabels) return {at: written, reason: "labels"};
      for (const e of theirs) {
        const found = difference(mine.find((m) => m.label === e.label)!.type, e.type, vars);
        if (found) return found;
      }
      return null;
    }
    default:
      return typeToString(written) === typeToString(expected) ? null : {at: written, reason: "value"};
  }
}

function markSubtype(node: unknown, target: Type): unknown {
  if (node === target) return {kind: "TyIdentifier", id: "marked", name: `⟦${typeToString(target)}⟧`};
  if (Array.isArray(node)) return node.map((item) => markSubtype(item, target));
  if (typeof node !== "object" || node === null) return node;
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, markSubtype(value, target)]));
}

function withoutOuterParens(text: string): string {
  if (!text.startsWith("(") || !text.endsWith(")")) return text;
  let depth = 0;
  for (let i = 0; i < text.length - 1; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") depth -= 1;
    if (depth === 0) return text;
  }
  return text.slice(1, -1);
}

// Points at the first place the written type diverges — never at what belongs there.
export function typeFeedback(written: Type, expected: Type, vars: VariableMatching, subject = "feedback.subject.type"): FeedbackMessage {
  const found = difference(written, expected, vars);
  if (!found) return {code: "feedback.typeInconsistent", params: {subject: translatedParam(subject)}};
  const marked = withoutOuterParens(typeToString(markSubtype(written, found.at) as Type));
  const params = {subject: translatedParam(subject), marked};
  switch (found.reason) {
    case "arity":
      return {code: "feedback.typeArity", params};
    case "labels":
      return {code: "feedback.typeLabels", params};
    case "variable":
      return {code: "feedback.typeVariable", params};
    default:
      return {code: "feedback.typeAt", params};
  }
}

interface Equation {
  left: Type;
  right: Type;
}

// Which written equations no rule-produced equation can account for, and how many are still missing.
export function constraintFeedback(written: Equation[], expected: Equation[], fits: (w: Equation, e: Equation) => boolean): FeedbackMessage[] {
  const fitsEither = (w: Equation, e: Equation) => fits(w, e) || fits({left: w.right, right: w.left}, e);
  const wrong = written
    .map((w, i) => ({w, i}))
    .filter(({w}) => !expected.some((e) => fitsEither(w, e)));
  const messages: FeedbackMessage[] = wrong.slice(0, 2).map(({w, i}) => ({
    code: "feedback.constraintWrong",
    params: {index: i + 1, equation: `${typeToString(w.left)} = ${typeToString(w.right)}`},
  }));
  const missing = expected.length - (written.length - wrong.length);
  if (missing > 0) messages.push({code: "feedback.constraintMissing"});
  else if (wrong.length === 0 && written.length > expected.length) messages.push({code: "feedback.constraintExtra"});
  if (messages.length === 0) messages.push({code: "feedback.constraintVariables"});
  return messages;
}
