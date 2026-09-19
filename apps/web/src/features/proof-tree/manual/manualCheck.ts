import type {InferProofTree, ProofTree, Type, TypeScheme} from "@vladyslav005/tt-core";
import {Rule, TexMapper, typeToString} from "@vladyslav005/tt-core";
import type {ManualMessage, ManualNode, ManualNodeResult} from "@/shared/ui-state/manualProof.ts";
import {typeSchemeToDisplayType} from "@/shared/ui-state/studentProof.ts";
import {isCtRule, isVarRule} from "@/shared/ui-state/ruleFamilies.ts";
import {RULE_LABELS} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";
import {
  type ConstraintPairText,
  type ContextEntries,
  type ContextKey,
  type Definitions,
  ManualParseError,
  definitionName,
  NO_DEFINITIONS,
  type ParsedFact,
  parseConstraintsText,
  parseContextText,
  parseFactText,
  parseTermProgram,
  parseTypeText,
  splitDefinition,
  programTermKey,
  setRequireTypeVariableTick,
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
  | {form: "generalize"; name: string; type: Type; scheme: Type};

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
      {kind: "fact", fact: {form: "generalize", name, type: value.type, scheme: scheme ? entryType(scheme) : value.type}},
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

function showContext(entries: ContextEntries): string {
  return entries.size === 0 ? "∅" : [...entries].map(([name, type]) => `${name} : ${typeToString(type)}`).join(", ");
}

type GeneralizeFact = Extract<ParsedFact, {form: "generalize"}>;

function generalizeContextProblem(parsed: GeneralizeFact, context: ContextEntries, letContext: ContextEntries): ManualMessage | null {
  const same = context.size === letContext.size
    && [...letContext].every(([name, type]) => context.has(name) && typeToString(context.get(name)!) === typeToString(type));
  if (same) return null;
  return {code: "factContextDiffers", params: {context: parsed.context, contents: showContext(context), expected: showContext(letContext)}};
}

// T must be the type written in the value premise, and the scheme what the body's Γ binds the let variable to.
function checkGeneralizeLinks(
  node: ManualNode,
  parsed: GeneralizeFact,
  expected: Extract<ExpectedFact, {form: "generalize"}>,
  letNode: ManualNode | null,
  definitions: Definitions,
): ManualMessage | null {
  if (!letNode) return null;
  const at = letNode.premises.findIndex((p) => p.id === node.id);
  const value = letNode.premises[at - 1];
  const body = letNode.premises[at + 1];

  if (value?.kind === "judgement" && value.type.trim() !== "") {
    try {
      const written = typeToString(parseTypeText(value.type));
      if (written !== typeToString(parsed.type)) {
        return {code: "generalizeType", params: {given: typeToString(parsed.type), premise: written}};
      }
    } catch (error) {
      if (!(error instanceof ManualParseError)) throw error;
    }
  }

  if (body?.kind === "judgement" && body.gamma.trim() !== "") {
    let bodyContext: ContextEntries | null = null;
    try {
      bodyContext = parseContextText(body.gamma, definitions);
    } catch (error) {
      if (!(error instanceof ManualParseError)) throw error;
    }
    if (bodyContext) {
      const bound = bodyContext.get(expected.name);
      if (!bound) return {code: "generalizeBodyMissing", params: {name: expected.name, contents: showContext(bodyContext)}};
      if (typeToString(bound) !== typeToString(parsed.scheme)) {
        return {code: "generalizeScheme", params: {name: expected.name, given: typeToString(parsed.scheme), bound: typeToString(bound)}};
      }
    }
  }
  return null;
}

function checkFact(
  node: ManualNode,
  expected: ExpectedFact,
  ren: Renaming,
  parent: {node: ManualNode | null; context: ContextEntries; contextParsed: boolean},
  definitions: Definitions,
): ManualNodeResult {
  const messages: ManualMessage[] = [];
  const parsed: ParsedFact | null = parseOrNull(() => parseFactText(node.fact), messages, "factParse");
  if (!parsed) return {fact: "invalid", messages};

  const shape = expected.form === "membership" ? "factMembership" : expected.form === "instantiate" ? "factInstantiate" : "factGeneralize";
  if (parsed.form !== expected.form) {
    return {fact: "invalid", messages: [{code: "factForm", params: {form: shape}}]};
  }

  // The context written after ∈ (or as generalize's second argument) must really be one, and for
  // membership and instantiate it must contain the very binding the fact claims.
  let context: ContextEntries;
  try {
    context = parseContextText(parsed.context, definitions);
  } catch (error) {
    const detail = error instanceof ManualParseError ? error.message : String(error);
    return {fact: "invalid", messages: [{code: "factContextParse", params: {detail}}]};
  }
  if (parsed.form !== "generalize") {
    const bound = context.get(parsed.name);
    if (!bound) {
      return {fact: "invalid", messages: [{code: "factContextMissing", params: {name: parsed.name, context: parsed.context, contents: showContext(context)}}]};
    }
    const claimed = parsed.form === "membership" ? parsed.type : parsed.scheme;
    if (typeToString(bound) !== typeToString(claimed)) {
      const params = {name: parsed.name, context: parsed.context, actual: typeToString(bound), claimed: typeToString(claimed)};
      return {fact: "invalid", messages: [{code: "factContextType", params}]};
    }
  }

  if (parsed.form === "generalize") {
    const problem = parent.contextParsed ? generalizeContextProblem(parsed, context, parent.context) : null;
    if (problem) return {fact: "invalid", messages: [problem]};
    const linked = checkGeneralizeLinks(node, parsed, expected as Extract<ExpectedFact, {form: "generalize"}>, parent.node, definitions);
    if (linked) return {fact: "invalid", messages: [linked]};
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
  ren: Renaming,
  usesConstraints: boolean,
  definitions: Definitions,
): {result: ManualNodeResult; context: ContextEntries; contextParsed: boolean} {
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
  const parsedContext = parseOrNull(() => parseContextText(node.gamma, definitions), messages, "gammaParse");
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
    if (!ok && missing.length === 0 && extra.length === 0) {
      const trial = cloneRenaming(ren);
      const differing = [...expected].filter(([name, type]) => {
        const attempt = cloneRenaming(trial);
        if (!matchType(parsedContext.get(name)!, type, attempt)) return true;
        commit(trial, attempt);
        return false;
      }).map(([name]) => name);
      messages.push(differing.length > 0 ? {code: "gammaTypes", params: {names: differing.join(", ")}} : {code: "gammaInconsistent"});
    }
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

  return {result, context, contextParsed: parsedContext !== null};
}

export type ManualResults = Record<string, ManualNodeResult>;

// Definitions written inline in fields join the ones from the Definitions box; a name defined twice
// with different content is reported on the node that repeats it.
function withInlineDefinitions(root: ManualNode, base: Definitions): {definitions: Definitions; duplicates: Map<string, string[]>} {
  const definitions: Definitions = {contexts: new Map(base.contexts), constraints: new Map(base.constraints)};
  const duplicates = new Map<string, string[]>();
  const note = (nodeId: string, name: string) => duplicates.set(nodeId, [...(duplicates.get(nodeId) ?? []), name]);

  const visit = (node: ManualNode) => {
    if (node.kind === "judgement") {
      for (const [text, kind] of [[node.gamma, "Γ"], [node.constraints, "C"]] as const) {
        const def = splitDefinition(text);
        if (!def || def.kind !== kind) continue;
        const target: Map<ContextKey, string> = kind === "C" ? definitions.constraints : definitions.contexts;
        const existing = target.get(def.index);
        if (existing !== undefined && existing.trim() !== def.rhs.trim()) note(node.id, definitionName(def.kind, def.index));
        else target.set(def.index, def.rhs);
      }
    }
    node.premises.forEach(visit);
  };
  visit(root);
  return {definitions, duplicates};
}

export function checkManualTree(root: ManualNode, answerKey: ProofTree, usesConstraints: boolean, boxDefinitions: Definitions = NO_DEFINITIONS): ManualResults {
  const results: ManualResults = {};
  setRequireTypeVariableTick(usesConstraints);
  const {definitions, duplicates} = withInlineDefinitions(root, boxDefinitions);
  const ren = emptyRenaming();

  const visit = (node: ManualNode, expected: ExpectedChild, parent: {node: ManualNode | null; context: ContextEntries; contextParsed: boolean}) => {
    if (expected.kind === "fact") {
      results[node.id] = node.kind === "fact"
        ? checkFact(node, expected.fact, ren, parent, definitions)
        : {fact: "invalid", messages: [{code: "expectedSideCondition"}]};
      return;
    }

    if (node.kind === "fact") {
      results[node.id] = {fact: "invalid", messages: [{code: "expectedJudgement"}]};
      return;
    }

    const {result, context, contextParsed} = checkJudgement(node, expected.node, ren, usesConstraints, definitions);
    for (const name of duplicates.get(node.id) ?? []) {
      result.messages.push({code: "definitionDuplicate", params: {name}});
      if (name.startsWith("C")) result.constraints = "invalid";
      else result.gamma = "invalid";
    }
    results[node.id] = result;
    const children = expectedChildren(expected.node);
    node.premises.forEach((premise, i) => {
      if (children[i]) visit(premise, children[i], {node, context, contextParsed});
      else results[premise.id] = {messages: [{code: "extraPremise"}]};
    });
  };

  visit(root, {kind: "proof", node: answerKey}, {node: null, context: new Map(), contextParsed: true});
  return results;
}
