import {AntlrParserAdapter, ParseSyntaxError, astToText, typeToString} from "@vladyslav005/tt-core";
import type {ParseOptions, Program, Term, Type} from "@vladyslav005/tt-core";

const parser = new AntlrParserAdapter();

// 'A is lexed as an identifier with this prefix and decoded back to a TyMetaVar after parsing
const MV_PREFIX = "__mv_";

export class ManualParseError extends Error {}

function message(error: unknown): string {
  if (error instanceof ParseSyntaxError) return error.errors[0]?.message ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

// The app prints schemes as "forall 'A. T"; also accept \forall and the shorthand ∀'A 'B. T.
function normalizeQuantifiers(text: string): string {
  return text
    .replace(/\\forall(?![A-Za-z])|\bforall\b/g, "∀")
    .replace(/∀\s*((?:'?[\p{L}_][\w']*\s+)+'?[\p{L}_][\w']*)\s*\./gu, (_match, binders: string) =>
      binders.trim().split(/\s+/).map((binder) => `∀${binder}.`).join(" "));
}

function encodeVariables(text: string): string {
  return text.replace(/'([A-Za-z_][A-Za-z0-9_]*)/g, `${MV_PREFIX}$1`);
}

function decodeVariables(type: Type): Type {
  return JSON.parse(JSON.stringify(type), (_key, value) => {
    if (value && typeof value === "object") {
      if (value.kind === "TyIdentifier" && typeof value.name === "string" && value.name.startsWith(MV_PREFIX)) {
        return {kind: "TyMetaVar", id: value.id, name: `'${value.name.slice(MV_PREFIX.length)}`};
      }
      if ((value.kind === "TyForall" || value.kind === "RecursiveType")
        && typeof value.typeVariable === "string" && value.typeVariable.startsWith(MV_PREFIX)) {
        return {...value, typeVariable: `'${value.typeVariable.slice(MV_PREFIX.length)}`};
      }
    }
    return value;
  });
}

const BASE_TYPE_NAMES = new Set(["Nat", "Bool", "Unit", "String"]);
let bareVariables = false;

// Module state because the type parser is reached through many call paths that carry no options.
// With inference on, a bare A is a type variable, as the lectures write it — the same one as 'A.
export function setBareTypeVariables(on: boolean): void {
  bareVariables = on;
}

function tickBareVariables(type: Type): Type {
  return JSON.parse(JSON.stringify(type), (_key, value) => {
    if (value && typeof value === "object") {
      if (value.kind === "TyIdentifier" && typeof value.name === "string" && !BASE_TYPE_NAMES.has(value.name) && !value.name.startsWith("'")) {
        return {kind: "TyMetaVar", id: value.id, name: `'${value.name}`};
      }
      if ((value.kind === "TyForall" || value.kind === "RecursiveType") && typeof value.typeVariable === "string" && !value.typeVariable.startsWith("'")) {
        return {...value, typeVariable: `'${value.typeVariable}`};
      }
    }
    return value;
  });
}

export function parseTypeText(text: string): Type {
  const source = text.trim();
  if (!source) throw new ManualParseError("nothing written here");
  try {
    const program = parser.parseExpression(`__t : ${encodeVariables(normalizeQuantifiers(source))};`);
    const decl = program.globals[0];
    if (!decl || decl.kind !== "VarDecl") throw new ManualParseError("not a type");
    const type = decodeVariables(decl.type);
    return bareVariables ? tickBareVariables(type) : type;
  } catch (error) {
    throw new ManualParseError(message(error));
  }
}

export function parseTermProgram(text: string, options?: ParseOptions): Program {
  const source = text.trim().replace(/[;\s]+$/, "");
  if (!source) throw new ManualParseError("nothing written here");
  try {
    const program = parser.parseExpression(`${source};`, options);
    if (!program.term) throw new ManualParseError("not a term");
    return program;
  } catch (error) {
    throw new ManualParseError(message(error));
  }
}

export const parseUntypedTerm = (text: string) => parseTermProgram(text, {keywordsAsIdentifiers: true}).term;

export function termKey(term: Term): string {
  return astToText({kind: "Program", id: "term-key", globals: [], term} as Program).trim().replace(/;$/, "").trim();
}

export function programTermKey(program: Program): string {
  return termKey(program.term as Term);
}

const CLOSER_OF: Record<string, string> = {"(": ")", "[": "]", "{": "}", "<": ">"};
const CLOSERS = new Set(Object.values(CLOSER_OF));

function splitAtTopLevel(text: string, separatorAt: (i: number) => number): string[] {
  const parts: string[] = [];
  const open: string[] = [];
  const openers: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in CLOSER_OF) {
      open.push(CLOSER_OF[ch]);
      openers.push(ch);
    } else if (CLOSERS.has(ch) && !(ch === ">" && (text[i - 1] === "-" || text[i - 1] === "="))) {
      if (open.pop() !== ch) throw new ManualParseError(`unmatched "${ch}"`);
      openers.pop();
    } else if (open.length === 0) {
      const width = separatorAt(i);
      if (width > 0) {
        parts.push(text.slice(start, i));
        i += width - 1;
        start = i + 1;
      }
    }
  }
  if (open.length > 0) throw new ManualParseError(`unclosed "${openers[openers.length - 1]}"`);
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

function nonEmpty(parts: string[], what: string): string[] {
  if (parts.length === 1) return parts[0] ? parts : [];
  if (parts.some((part) => !part)) throw new ManualParseError(`empty ${what} — check for a stray or doubled separator`);
  return parts;
}

export function splitTopLevel(text: string, separator: string): string[] {
  return nonEmpty(splitAtTopLevel(text, (i) => (text.startsWith(separator, i) ? separator.length : 0)), "item");
}

export function stripBraces(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
}

const CUP = /\\cup(?![A-Za-z])/y;

export function splitUnion(text: string): string[] {
  const separatorAt = (i: number) => {
    if (text[i] === "∪") return 1;
    CUP.lastIndex = i;
    return CUP.test(text) ? 4 : 0;
  };
  return nonEmpty(splitAtTopLevel(text, separatorAt), "operand of ∪");
}

export const EMPTY_SET = new Set(["", "∅", "\\emptyset", "empty"]);
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const subscriptToNumber = (s: string) => Number([...s].map((c) => SUBSCRIPT_DIGITS.indexOf(c)).join(""));

export const GAMMA_REF = /^(?:Γ|\\Gamma|Gamma)(?:_?\{?(\d+)\}?|([₀-₉]+))?$/;
export const CONSTRAINT_REF = /^C(?:_?\{?(\d+)\}?|([₀-₉]+))$/;

export function refIndex(match: RegExpExecArray): number | undefined {
  if (match[1] !== undefined) return Number(match[1]);
  if (match[2] !== undefined) return subscriptToNumber(match[2]);
  return undefined;
}

export type ContextKey = number | null;

export interface Definitions {
  contexts: Map<ContextKey, string>;
  constraints: Map<number, string>;
}

export const NO_DEFINITIONS: Definitions = {contexts: new Map(), constraints: new Map()};

export interface DefinitionError {
  line: number;
  message: string;
}

export const definitionName = (kind: "Γ" | "C", index: ContextKey): string => (index === null ? kind : `${kind}_${index}`);

export const DEFINITION_LINE = /^(Γ|\\Gamma|Gamma|C)\s*(?:_?\{?(\d+)\}?|([₀-₉]+))?\s*(?::=|=)\s*(.*)$/;

export type SplitDefinition = {kind: "Γ"; index: ContextKey; rhs: string} | {kind: "C"; index: number; rhs: string};

// "Γ_2 = {x : 'B}" written straight in a field: it is that node's value and also defines Γ_2 (a plain "Γ = …" defines the unindexed Γ).
export function splitDefinition(text: string): SplitDefinition | null {
  const m = DEFINITION_LINE.exec(text.trim());
  if (!m) return null;
  const index = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? subscriptToNumber(m[3]) : null;
  if (m[1] !== "C") return {kind: "Γ", index, rhs: m[4]};
  return index === null ? null : {kind: "C", index, rhs: m[4]};
}

export function parseDefinitions(text: string): {definitions: Definitions; errors: DefinitionError[]} {
  const definitions: Definitions = {contexts: new Map(), constraints: new Map()};
  const errors: DefinitionError[] = [];
  const lines = text.split("\n");

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const def = splitDefinition(line);
    if (!def) {
      errors.push({line: i + 1, message: 'expected "Γ = …", "Γ_n = …" or "C_n = …"'});
      return;
    }
    const target: Map<ContextKey, string> = def.kind === "C" ? definitions.constraints : definitions.contexts;
    if (target.has(def.index)) errors.push({line: i + 1, message: `${definitionName(def.kind, def.index)} is defined twice`});
    target.set(def.index, def.rhs);
  });

  const lineOf = (kind: "Γ" | "C", index: ContextKey) =>
    lines.findIndex((l) => { const d = splitDefinition(l); return d !== null && d.kind === kind && d.index === index; }) + 1;
  definitions.contexts.forEach((_rhs, index) => {
    try {
      parseContextText(definitionName("Γ", index), definitions);
    } catch (error) {
      errors.push({line: lineOf("Γ", index), message: error instanceof Error ? error.message : String(error)});
    }
  });
  definitions.constraints.forEach((_rhs, index) => {
    try {
      parseConstraintsText(`C_${index}`, [], definitions);
    } catch (error) {
      errors.push({line: lineOf("C", index), message: error instanceof Error ? error.message : String(error)});
    }
  });
  return {definitions, errors};
}

export type ContextEntries = Map<string, Type>;

function bind(entries: ContextEntries, name: string, type: Type): void {
  const existing = entries.get(name);
  if (existing && typeToString(existing) !== typeToString(type)) {
    throw new ManualParseError(`"${name}" is bound twice with different types — remove the old one first, e.g. Γ − {${name}}`);
  }
  entries.set(name, type);
}

export function parseContextText(
  text: string,
  definitions: Definitions = NO_DEFINITIONS,
  expanding: readonly ContextKey[] = [],
): ContextEntries {
  const inline = splitDefinition(text);
  if (inline?.kind === "Γ") return parseContextText(inline.rhs, definitions, [...expanding, inline.index]);
  const entries: ContextEntries = new Map();
  for (const operand of splitUnion(text)) {
    parseContextOperand(operand, definitions, expanding).forEach((type, name) => bind(entries, name, type));
  }
  return entries;
}

const SETMINUS = /\\setminus(?![A-Za-z])/y;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function splitDifference(text: string): string[] {
  const separatorAt = (i: number) => {
    if (text[i] === "∖" || text[i] === "−" || (text[i] === "-" && text[i + 1] !== ">")) return 1;
    SETMINUS.lastIndex = i;
    return SETMINUS.test(text) ? 9 : 0;
  };
  const parts = splitAtTopLevel(text, separatorAt);
  if (parts.length > 1 && parts.some((part) => !part)) throw new ManualParseError('a "−" needs a set on both sides');
  return parts;
}

export function unwrapParens(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("(")) return null;
  const group = balancedInside(trimmed, 0);
  return group && group.rest.trim() === "" ? group.inside : null;
}

export function parseNameSet(text: string): string[] {
  const names = splitTopLevel(stripBraces(text), ",");
  const bad = names.find((name) => !IDENTIFIER.test(name));
  if (bad !== undefined) throw new ManualParseError(`"${bad}" is not a variable name`);
  if (names.length === 0) throw new ManualParseError("nothing to remove — list the names, e.g. Γ − {x}");
  return names;
}

function parseContextOperand(text: string, definitions: Definitions, expanding: readonly ContextKey[]): ContextEntries {
  const inner = unwrapParens(text);
  if (inner !== null) return parseContextText(inner, definitions, expanding);
  const [base, ...removals] = splitDifference(text);
  if (removals.length > 0) {
    const entries = new Map(parseContextOperand(base, definitions, expanding));
    for (const name of removals.flatMap(parseNameSet)) {
      if (!entries.delete(name)) throw new ManualParseError(`"${name}" isn't in the set it is removed from`);
    }
    return entries;
  }
  const body = stripBraces(text);
  if (EMPTY_SET.has(body.trim())) return new Map();
  const entries: ContextEntries = new Map();
  for (const item of splitTopLevel(body, ",")) {
    const ref = GAMMA_REF.exec(item);
    if (ref) {
      const key = refIndex(ref) ?? null;
      const name = definitionName("Γ", key);
      const definition = definitions.contexts.get(key);
      if (definition === undefined) {
        throw new ManualParseError(`${name} isn't defined — add "${name} = …" under Definitions or write it in a Γ field`);
      }
      if (expanding.includes(key)) throw new ManualParseError(`${name} is defined in terms of itself`);
      parseContextText(definition, definitions, [...expanding, key]).forEach((type, entry) => bind(entries, entry, type));
      continue;
    }
    const colon = item.indexOf(":");
    if (colon < 0) throw new ManualParseError(`"${item}" is not "name : type"`);
    const name = item.slice(0, colon).trim();
    if (!IDENTIFIER.test(name)) throw new ManualParseError(`"${name}" is not a variable name`);
    bind(entries, name, parseTypeText(item.slice(colon + 1)));
  }
  return entries;
}

export interface ConstraintPairText {
  left: Type;
  right: Type;
}


export function parseConstraintsText(
  text: string,
  premiseSets: (ConstraintPairText[] | undefined)[] = [],
  definitions: Definitions = NO_DEFINITIONS,
  expanding: readonly number[] = [],
): ConstraintPairText[] {
  const inline = splitDefinition(text);
  if (inline?.kind === "C") return parseConstraintsText(inline.rhs, premiseSets, definitions, [...expanding, inline.index]);
  return splitUnion(text).flatMap((operand) => {
    const ref = CONSTRAINT_REF.exec(operand);
    if (ref) {
      const index = refIndex(ref) as number;
      const definition = definitions.constraints.get(index);
      if (definition !== undefined) {
        if (expanding.includes(index)) throw new ManualParseError(`C_${index} is defined in terms of itself`);
        return parseConstraintsText(definition, [], definitions, [...expanding, index]);
      }
      const set = premiseSets[index - 1];
      if (!set) throw new ManualParseError(`${operand} refers to a premise that doesn't exist or has no constraint set`);
      return set;
    }
    return parseConstraintOperand(operand);
  });
}

function parseConstraintOperand(text: string): ConstraintPairText[] {
  const body = stripBraces(text);
  if (EMPTY_SET.has(body.trim())) return [];
  return splitTopLevel(body, ",").map((item) => {
    const sides = splitEquation(item);
    if (!sides) throw new ManualParseError(`"${item}" is not an equation "A = B"`);
    return {left: parseTypeText(sides[0]), right: parseTypeText(sides[1])};
  });
}

export function splitEquation(item: string): [string, string] | null {
  const isEquals = (i: number) => (item[i] === "=" && item[i + 1] !== ">" && item[i - 1] !== "<" && item[i - 1] !== ">" ? 1 : 0);
  const sides = splitAtTopLevel(item, isEquals);
  return sides.length === 2 ? [sides[0], sides[1]] : null;
}

export type ParsedFact =
  | {form: "membership"; name: string; type: Type; context: string}
  | {form: "instantiate"; name: string; scheme: Type; context: string}
  // `constraints`/`name` only in the lecture's form generalize(C₁, Γ, x : T₁) = x : S.
  | {form: "generalize"; type: Type; scheme: Type; context: string; constraints?: string; name?: string};

const MEMBER = /(?:∈|\\in(?![A-Za-z]))/y;

function splitMembership(text: string): string[] {
  return splitAtTopLevel(text, (i) => {
    MEMBER.lastIndex = i;
    const m = MEMBER.exec(text);
    return m ? m[0].length : 0;
  });
}

function requireContext(context: string | undefined, shape: string): string {
  if (!context) throw new ManualParseError(`expected "${shape}" — the context is missing`);
  return context;
}

function balancedInside(text: string, open: number): {inside: string; rest: string} | null {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") {
      depth--;
      if (depth === 0) return {inside: text.slice(open + 1, i), rest: text.slice(i + 1)};
    }
  }
  return null;
}

// The lecture writes CT-VarLet's premise as a judgement: Γ ⊢ instantiate(x : S ∈ Γ) | { }.
function unwrapJudgement(source: string): string {
  const turnstile = /^[^()]*?(?:⊢|\\vdash(?![A-Za-z]))\s*(?=instantiate\s*\()/i.exec(source);
  if (!turnstile) return source;
  return source.slice(turnstile[0].length).replace(/\s*[|∣]\s*(?:\{\s*\}|∅|\\emptyset)\s*$/, "");
}

export function parseFactText(text: string): ParsedFact {
  const source = unwrapJudgement(text.trim().replace(/\\mathit\{(\w+)\}/g, "$1"));

  const unknown = /^([A-Za-z]\w*)\s*\(/.exec(source);
  const call = /^(generali[sz]e|instantiate)\s*\(/i.exec(source);
  if (unknown && !call) {
    throw new ManualParseError(`unknown side condition "${unknown[1]}(…)" — use "x : T ∈ Γ_n", "instantiate(x : S ∈ Γ_n)" or "generalize(C_n, Γ_n, x : T) = x : S"`);
  }
  if (call) {
    const parts = balancedInside(source, call[0].length - 1);
    if (!parts) throw new ManualParseError("unbalanced parentheses");
    if (call[1].toLowerCase() === "instantiate") {
      const shape = "instantiate(x : scheme ∈ Γ)";
      const sides = splitMembership(parts.inside);
      const colon = sides[0].indexOf(":");
      if (sides.length !== 2 || colon < 0) throw new ManualParseError(`expected "${shape}"`);
      return {
        form: "instantiate",
        name: sides[0].slice(0, colon).trim(),
        scheme: parseTypeText(sides[0].slice(colon + 1)),
        context: requireContext(sides[1], shape),
      };
    }
    const args = splitAtTopLevel(parts.inside, (i) => (parts.inside[i] === "," ? 1 : 0));
    const rest = parts.rest.trim().replace(/^:=/, "=");
    const binding = args.length >= 3 ? /^([A-Za-z_]\w*)\s*:(?!=)([\s\S]*)$/.exec(args[args.length - 1]) : null;
    if (binding) {
      // The lecture's form: generalize(C₁, Γ, x : T₁) = x : S, where S generalizes T₁ under C₁'s solution.
      const shape = "generalize(C, Γ, x : T) = x : scheme";
      if (!rest.startsWith("=")) throw new ManualParseError(`expected "${shape}" — write "= ${binding[1]} : scheme" after the closing parenthesis`);
      const result = /^([A-Za-z_]\w*)\s*:(?!=)([\s\S]*)$/.exec(rest.slice(1).trim());
      if (result && result[1] !== binding[1]) throw new ManualParseError(`the result binds ${result[1]}, but generalize was given ${binding[1]}`);
      return {
        form: "generalize",
        constraints: args[0],
        name: binding[1],
        type: parseTypeText(binding[2]),
        scheme: parseTypeText(result ? result[2] : rest.slice(1)),
        context: requireContext(args.slice(1, -1).join(", "), shape),
      };
    }
    const shape = "generalize(T, Γ) = scheme";
    const [type, ...context] = args;
    if (context.length === 0) throw new ManualParseError(`expected "${shape}" — the context (second argument) is missing`);
    if (!rest.startsWith("=")) throw new ManualParseError(`expected "${shape}" — write "= scheme" after the closing parenthesis`);
    return {
      form: "generalize",
      type: parseTypeText(type),
      scheme: parseTypeText(rest.slice(1)),
      context: requireContext(context.join(", "), shape),
    };
  }

  const shape = "x : T ∈ Γ";
  const sides = splitMembership(source);
  const colon = sides[0].indexOf(":");
  if (sides.length !== 2 || colon < 0) throw new ManualParseError(`expected "${shape}"`);
  return {
    form: "membership",
    name: sides[0].slice(0, colon).trim(),
    type: parseTypeText(sides[0].slice(colon + 1)),
    context: requireContext(sides[1], shape),
  };
}
