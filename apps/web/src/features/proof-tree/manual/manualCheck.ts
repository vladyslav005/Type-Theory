import type {InferProofTree, ProofTree, Type, TypeScheme} from "@vladyslav005/tt-core";
import {Rule, TexMapper, typeToString} from "@vladyslav005/tt-core";
import type {ManualMessage, ManualNode, ManualNodeResult} from "@/shared/ui-state/manualProof.ts";
import {typeSchemeToDisplayType} from "@/shared/ui-state/studentProof.ts";
import {isCtRule, isVarRule} from "@/shared/ui-state/ruleFamilies.ts";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";
import {
  type ConstraintPairText,
  type ContextEntries,
  type Definitions,
  ManualParseError,
  NO_DEFINITIONS,
  type ParsedFact,
  parseConstraintsText,
  parseContextText,
  parseFactText,
  parseTermProgram,
  parseTypeText,
  programTermKey,
  termKey,
} from "@/shared/lib/manualParse.ts";

interface Renaming {
  expectedToWritten: Map<string, string>;
  writtenToExpected: Map<string, string>;
}

const emptyRenaming = (): Renaming => ({expectedToWritten: new Map(), writtenToExpected: new Map()});
const cloneRenaming = (r: Renaming): Renaming => ({
  expectedToWritten: new Map(r.expectedToWritten),
  writtenToExpected: new Map(r.writtenToExpected),
});
function commit(into: Renaming, from: Renaming): void {
  into.expectedToWritten = from.expectedToWritten;
  into.writtenToExpected = from.writtenToExpected;
}

function bindVariable(written: string, expected: string, ren: Renaming): boolean {
  const mappedWritten = ren.expectedToWritten.get(expected);
  const mappedExpected = ren.writtenToExpected.get(written);
  if (mappedWritten !== undefined || mappedExpected !== undefined) {
    return mappedWritten === written && mappedExpected === expected;
  }
  ren.expectedToWritten.set(expected, written);
  ren.writtenToExpected.set(written, expected);
  return true;
}

function matchAll(written: Type[], expected: Type[], ren: Renaming): boolean {
  return written.length === expected.length && expected.every((e, i) => matchType(written[i], e, ren));
}

// a plain identifier never matches an inference variable
function matchType(written: Type, expected: Type, ren: Renaming): boolean {
  if (expected.kind === "TyMetaVar") {
    return written.kind === "TyMetaVar" && bindVariable(written.name, expected.name, ren);
  }
  if (written.kind !== expected.kind) return false;

  switch (expected.kind) {
    case "TyIdentifier":
      return (written as typeof expected).name === expected.name;
    case "TyArrow": {
      const w = written as typeof expected;
      return matchType(w.from, expected.from, ren) && matchType(w.to, expected.to, ren);
    }
    case "TupleType":
      return matchAll((written as typeof expected).elements, expected.elements, ren);
    case "SumType": {
      const w = written as typeof expected;
      return matchType(w.left, expected.left, ren) && matchType(w.right, expected.right, ren);
    }
    case "ListType":
      return matchType((written as typeof expected).elementType, expected.elementType, ren);
    case "TyForall": {
      const w = written as typeof expected;
      return bindVariable(w.typeVariable, expected.typeVariable, ren) && matchType(w.type, expected.type, ren);
    }
    case "RecordType": {
      const w = written as typeof expected;
      return w.fields.length === expected.fields.length
        && expected.fields.every((f) => {
          const m = w.fields.find((x) => x.label === f.label);
          return m !== undefined && matchType(m.type, f.type, ren);
        });
    }
    case "VariantType": {
      const w = written as typeof expected;
      return w.variants.length === expected.variants.length
        && expected.variants.every((v) => {
          const m = w.variants.find((x) => x.label === v.label);
          return m !== undefined && matchType(m.type, v.type, ren);
        });
    }
    default:
      return typeToString(written) === typeToString(expected);
  }
}

// keeps the renaming only when the match succeeds
function tryMatch(ren: Renaming, attempt: (scratch: Renaming) => boolean): boolean {
  const scratch = cloneRenaming(ren);
  if (!attempt(scratch)) return false;
  commit(ren, scratch);
  return true;
}

interface Pair {
  left: Type;
  right: Type;
}

function solveConstraints(written: Pair[], expected: Pair[], index: number, used: Set<number>, ren: Renaming): Renaming | null {
  if (index === expected.length) return ren;
  const e = expected[index];
  for (let j = 0; j < written.length; j++) {
    if (used.has(j)) continue;
    for (const flip of [false, true]) {
      const scratch = cloneRenaming(ren);
      const w = flip ? {left: written[j].right, right: written[j].left} : written[j];
      if (matchType(w.left, e.left, scratch) && matchType(w.right, e.right, scratch)) {
        const next = new Set(used).add(j);
        const result = solveConstraints(written, expected, index + 1, next, scratch);
        if (result) return result;
      }
    }
  }
  return null;
}

type ExpectedFact =
  | {form: "membership"; name: string; type: Type}
  | {form: "instantiate"; name: string; scheme: Type}
  | {form: "generalize"; type: Type; scheme: Type};

type ExpectedChild = {kind: "proof"; node: ProofTree} | {kind: "fact"; fact: ExpectedFact};

function entryType(value: Type | TypeScheme): Type {
  return value.kind === "TypeScheme" ? typeSchemeToDisplayType(value) : value;
}

function expectedChildren(answer: ProofTree): ExpectedChild[] {
  if (isVarRule(answer.rule) && answer.premises.length === 0) {
    const name = (answer.term as {name?: string}).name ?? "";
    const bound = answer.gamma[name];
    if (answer.rule === Rule.CtVarLet && bound) {
      return [{kind: "fact", fact: {form: "instantiate", name, scheme: entryType(bound)}}];
    }
    return [{kind: "fact", fact: {form: "membership", name, type: bound ? entryType(bound) : answer.type}}];
  }

  if (answer.rule === Rule.CtLet && answer.premises.length === 2) {
    const [value, body] = answer.premises;
    const name = (answer.term as {name?: string}).name ?? "";
    const scheme = body.gamma[name];
    return [
      {kind: "proof", node: value},
      {kind: "fact", fact: {form: "generalize", type: value.type, scheme: scheme ? entryType(scheme) : value.type}},
      {kind: "proof", node: body},
    ];
  }

  return answer.premises.map((node): ExpectedChild => ({kind: "proof", node}));
}

function acceptedRuleNames(answer: ProofTree): string[] {
  const names = new Set<string>();
  const label = RULE_LABELS[answer.rule];
  if (label) names.add(label);

  const ct = isCtRule(answer.rule);
  const prefix = ct ? "CT-" : "T-";
  if (answer.rule === Rule.Lit || answer.rule === Rule.CtLit) {
    ["Lit", "Unit", "True", "False", "String", "Nv"].forEach((n) => names.add(`${prefix}${n}`));
  }
  if (answer.rule === Rule.BinOp || answer.rule === Rule.CtBinOp) {
    const operator = (answer.term as {operator?: never}).operator;
    if (operator !== undefined) names.add(`${prefix}${TexMapper.binOpRuleName(operator)}`);
  }
  if (isVarRule(answer.rule) && answer.premises.length > 0) names.add(`${prefix}Def`);
  return [...names];
}

const normalizeRule = (text: string) => text.replace(/[\s–—−_-]/g, "").toLowerCase();

function contextOf(node: ProofTree): ContextEntriesExpected {
  return new Map(Object.entries(node.gamma).map(([name, value]) => [name, entryType(value)]));
}
type ContextEntriesExpected = Map<string, Type>;

function parseOrNull<T>(parse: () => T, messages: ManualMessage[], code: string): T | null {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ManualParseError) {
      messages.push({code, params: {detail: error.message}});
      return null;
    }
    throw error;
  }
}

function checkFact(node: ManualNode, expected: ExpectedFact, ren: Renaming): ManualNodeResult {
  const messages: ManualMessage[] = [];
  const parsed: ParsedFact | null = parseOrNull(() => parseFactText(node.fact), messages, "factParse");
  if (!parsed) return {fact: "invalid", messages};

  const shape = expected.form === "membership" ? "factMembership" : expected.form === "instantiate" ? "factInstantiate" : "factGeneralize";
  if (parsed.form !== expected.form) {
    return {fact: "invalid", messages: [{code: "factForm", params: {form: shape}}]};
  }

  const ok = tryMatch(ren, (scratch) => {
    if (parsed.form === "membership" && expected.form === "membership") {
      return parsed.name === expected.name && matchType(parsed.type, expected.type, scratch);
    }
    if (parsed.form === "instantiate" && expected.form === "instantiate") {
      return parsed.name === expected.name && matchType(parsed.scheme, expected.scheme, scratch);
    }
    if (parsed.form === "generalize" && expected.form === "generalize") {
      return matchType(parsed.type, expected.type, scratch) && matchType(parsed.scheme, expected.scheme, scratch);
    }
    return false;
  });
  return {fact: ok ? "valid" : "invalid", messages: ok ? [] : [{code: "factMismatch"}]};
}

// C₁, C₂, ... refer to the judgement premises in order
function premiseConstraintSets(node: ManualNode, definitions: Definitions): (ConstraintPairText[] | undefined)[] {
  return node.premises
    .filter((p) => p.kind === "judgement")
    .map((p) => {
      try {
        return parseConstraintsText(p.constraints, premiseConstraintSets(p, definitions), definitions);
      } catch {
        return undefined;
      }
    });
}

function checkJudgement(
  node: ManualNode,
  answer: ProofTree,
  parentContext: ContextEntries,
  ren: Renaming,
  usesConstraints: boolean,
  definitions: Definitions,
): {result: ManualNodeResult; context: ContextEntries} {
  const messages: ManualMessage[] = [];
  const result: ManualNodeResult = {messages};

  const written = normalizeRule(node.rule);
  result.rule = acceptedRuleNames(answer).some((n) => normalizeRule(n) === written) ? "valid" : "invalid";
  if (result.rule === "invalid") messages.push({code: node.rule.trim() ? "ruleMismatch" : "ruleMissing"});

  const program = parseOrNull(() => parseTermProgram(node.term), messages, "termParse");
  if (program) {
    const same = programTermKey(program) === termKey(answer.term);
    result.term = same ? "valid" : "invalid";
    if (!same) messages.push({code: "termMismatch"});
  } else {
    result.term = "invalid";
  }

  let context: ContextEntries = new Map();
  const parsedContext = parseOrNull(() => parseContextText(node.gamma, parentContext, definitions), messages, "gammaParse");
  if (parsedContext) {
    context = parsedContext;
    const expected = contextOf(answer);
    const missing = [...expected.keys()].filter((name) => !parsedContext.has(name));
    const extra = [...parsedContext.keys()].filter((name) => !expected.has(name));
    const ok = missing.length === 0 && extra.length === 0
      && tryMatch(ren, (scratch) => [...expected].every(([name, type]) => matchType(parsedContext.get(name)!, type, scratch)));
    result.gamma = ok ? "valid" : "invalid";
    if (missing.length > 0) messages.push({code: "gammaMissing", params: {names: missing.join(", ")}});
    if (extra.length > 0) messages.push({code: "gammaExtra", params: {names: extra.join(", ")}});
    if (!ok && missing.length === 0 && extra.length === 0) messages.push({code: "gammaTypes"});
  } else {
    result.gamma = "invalid";
  }

  const type = parseOrNull(() => parseTypeText(node.type), messages, "typeParse");
  if (type) {
    const ok = tryMatch(ren, (scratch) => matchType(type, answer.type, scratch));
    result.type = ok ? "valid" : "invalid";
    if (!ok) messages.push({code: "typeMismatch"});
  } else {
    result.type = "invalid";
  }

  const constraintsShown = node.constraintsShown ?? usesConstraints;
  if (!isCtRule(answer.rule) && constraintsShown && node.constraints.trim() !== "") {
    result.constraints = "invalid";
    messages.push({code: "constraintsNotExpected"});
  } else if (isCtRule(answer.rule) && !constraintsShown) {
    result.constraints = "invalid";
    messages.push({code: "constraintsRequired"});
  } else if (isCtRule(answer.rule)) {
    const expected = ((answer as InferProofTree).constraints ?? []).map((c) => ({left: c.left, right: c.right}));
    const pairs = parseOrNull(() => parseConstraintsText(node.constraints, premiseConstraintSets(node, definitions), definitions), messages, "constraintsParse");
    if (pairs) {
      const solved = solveConstraints(pairs, expected, 0, new Set(), cloneRenaming(ren));
      const ok = pairs.length === expected.length && solved !== null;
      if (ok && solved) commit(ren, solved);
      result.constraints = ok ? "valid" : "invalid";
      if (!ok) messages.push({code: "constraintsMismatch", params: {expected: expected.length, written: pairs.length}});
    } else {
      result.constraints = "invalid";
    }
  }

  const expectedCount = expectedChildren(answer).length;
  result.premises = node.premises.length === expectedCount ? "valid" : "invalid";
  if (result.premises === "invalid") {
    messages.push({code: "premiseCount", params: {expected: expectedCount, written: node.premises.length}});
  }

  return {result, context};
}

export type ManualResults = Record<string, ManualNodeResult>;

export function checkManualTree(root: ManualNode, answerKey: ProofTree, usesConstraints: boolean, definitions: Definitions = NO_DEFINITIONS): ManualResults {
  const results: ManualResults = {};
  const ren = emptyRenaming();

  const visit = (node: ManualNode, expected: ExpectedChild, parentContext: ContextEntries) => {
    if (expected.kind === "fact") {
      results[node.id] = node.kind === "fact"
        ? checkFact(node, expected.fact, ren)
        : {fact: "invalid", messages: [{code: "expectedSideCondition"}]};
      return;
    }

    if (node.kind === "fact") {
      results[node.id] = {fact: "invalid", messages: [{code: "expectedJudgement"}]};
      return;
    }

    const {result, context} = checkJudgement(node, expected.node, parentContext, ren, usesConstraints, definitions);
    results[node.id] = result;
    const children = expectedChildren(expected.node);
    node.premises.forEach((premise, i) => {
      if (children[i]) visit(premise, children[i], context);
      else results[premise.id] = {messages: [{code: "extraPremise"}]};
    });
  };

  visit(root, {kind: "proof", node: answerKey}, new Map());
  return results;
}
