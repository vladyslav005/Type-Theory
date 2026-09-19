import {AntlrParserAdapter, ParseSyntaxError, astToText} from "@vladyslav005/tt-core";
import type {Program, Term, Type} from "@vladyslav005/tt-core";

const parser = new AntlrParserAdapter();

// The surface grammar has no notation for inference variables, so 'A is lexed as an ordinary
// identifier under this prefix and turned back into a TyMetaVar after parsing.
const MV_PREFIX = "__mv_";

export class ManualParseError extends Error {}

function message(error: unknown): string {
  if (error instanceof ParseSyntaxError) return error.errors[0]?.message ?? error.message;
  return error instanceof Error ? error.message : String(error);
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

export function parseTypeText(text: string): Type {
  const source = text.trim();
  if (!source) throw new ManualParseError("nothing written here");
  try {
    const program = parser.parseExpression(`__t : ${encodeVariables(source)};`);
    const decl = program.globals[0];
    if (!decl || decl.kind !== "VarDecl") throw new ManualParseError("not a type");
    return decodeVariables(decl.type);
  } catch (error) {
    throw new ManualParseError(message(error));
  }
}

export function parseTermProgram(text: string): Program {
  const source = text.trim().replace(/[;\s]+$/, "");
  if (!source) throw new ManualParseError("nothing written here");
  try {
    const program = parser.parseExpression(`${source};`);
    if (!program.term) throw new ManualParseError("not a term");
    return program;
  } catch (error) {
    throw new ManualParseError(message(error));
  }
}

// Canonical text of a term, so two spellings of the same term compare equal.
export function termKey(term: Term): string {
  return astToText({kind: "Program", id: "term-key", globals: [], term} as Program).trim().replace(/;$/, "").trim();
}

export function programTermKey(program: Program): string {
  return termKey(program.term as Term);
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function stripBraces(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed.slice(1, -1) : trimmed;
}

// Splits on a top-level union symbol, so "Γ_1 ∪ {x : T}" is two operands.
function splitUnion(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (depth === 0 && (ch === "∪" || text.startsWith("\\cup", i))) {
      parts.push(current);
      current = "";
      if (ch !== "∪") i += 3;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const EMPTY_SET = new Set(["", "∅", "\\emptyset", "empty"]);
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const subscriptToNumber = (s: string) => Number([...s].map((c) => SUBSCRIPT_DIGITS.indexOf(c)).join(""));

// Γ, Γ_1, Γ₁, Γ_{12}, \Gamma1, ... — the index is undefined for a bare Γ.
const GAMMA_REF = /^(?:Γ|\\Gamma|Gamma)(?:_?\{?(\d+)\}?|([₀-₉]+))?$/;
const CONSTRAINT_REF = /^C(?:_?\{?(\d+)\}?|([₀-₉]+))$/;

function refIndex(match: RegExpExecArray): number | undefined {
  if (match[1] !== undefined) return Number(match[1]);
  if (match[2] !== undefined) return subscriptToNumber(match[2]);
  return undefined;
}

// Named sets the student defined once and reuses (Γ_1 = {x : 'A}, C_1 = {...}), kept as raw text and
// expanded on use so a reference is judged by what it stands for.
export interface Definitions {
  contexts: Map<number, string>;
  constraints: Map<number, string>;
}

export const NO_DEFINITIONS: Definitions = {contexts: new Map(), constraints: new Map()};

export interface DefinitionError {
  line: number;
  message: string;
}

const DEFINITION_LINE = /^(Γ|\\Gamma|Gamma|C)\s*(?:_?\{?(\d+)\}?|([₀-₉]+))\s*(?::=|=)\s*(.*)$/;

export function parseDefinitions(text: string): {definitions: Definitions; errors: DefinitionError[]} {
  const definitions: Definitions = {contexts: new Map(), constraints: new Map()};
  const errors: DefinitionError[] = [];

  text.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const match = DEFINITION_LINE.exec(line);
    if (!match) {
      errors.push({line: i + 1, message: 'expected "Γ_n = …" or "C_n = …"'});
      return;
    }
    const index = match[2] !== undefined ? Number(match[2]) : subscriptToNumber(match[3]);
    const target = match[1] === "C" ? definitions.constraints : definitions.contexts;
    if (target.has(index)) errors.push({line: i + 1, message: `${match[1] === "C" ? "C" : "Γ"}_${index} is defined twice`});
    target.set(index, match[4]);
  });

  // Surface a definition that can't be read (or refers in circles) right where it's written.
  const lines = text.split("\n");
  const lineOf = (kind: "Γ" | "C", index: number) =>
    lines.findIndex((l) => { const m = DEFINITION_LINE.exec(l.trim()); return m && (m[1] === "C" ? "C" : "Γ") === kind && (m[2] !== undefined ? Number(m[2]) : subscriptToNumber(m[3])) === index; }) + 1;
  definitions.contexts.forEach((_rhs, index) => {
    try {
      parseContextText(`Γ_${index}`, new Map(), definitions);
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

// "x : T, y : U", "∅", an extension of the parent's context ("Γ, x : T"), or a union of these
// ("Γ_1 ∪ {x : T}").
export function parseContextText(
  text: string,
  parent: ContextEntries,
  definitions: Definitions = NO_DEFINITIONS,
  expanding: readonly number[] = [],
): ContextEntries {
  const entries: ContextEntries = new Map();
  for (const operand of splitUnion(text)) {
    parseContextOperand(operand, parent, definitions, expanding).forEach((type, name) => entries.set(name, type));
  }
  return entries;
}

function parseContextOperand(text: string, parent: ContextEntries, definitions: Definitions, expanding: readonly number[]): ContextEntries {
  const body = stripBraces(text);
  if (EMPTY_SET.has(body.trim())) return new Map();
  const entries: ContextEntries = new Map();
  for (const item of splitTopLevel(body, ",")) {
    const ref = GAMMA_REF.exec(item);
    if (ref) {
      const index = refIndex(ref);
      const definition = index === undefined ? undefined : definitions.contexts.get(index);
      if (index !== undefined && definition !== undefined) {
        if (expanding.includes(index)) throw new ManualParseError(`Γ_${index} is defined in terms of itself`);
        // A definition stands alone — there is no parent context inside it.
        parseContextText(definition, new Map(), definitions, [...expanding, index]).forEach((type, name) => entries.set(name, type));
      } else if (index !== undefined) {
        throw new ManualParseError(`Γ_${index} isn't defined — add it under Definitions`);
      } else {
        parent.forEach((type, name) => entries.set(name, type));
      }
      continue;
    }
    const colon = item.indexOf(":");
    if (colon < 0) throw new ManualParseError(`"${item}" is not "name : type"`);
    const name = item.slice(0, colon).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new ManualParseError(`"${name}" is not a variable name`);
    entries.set(name, parseTypeText(item.slice(colon + 1)));
  }
  return entries;
}

export interface ConstraintPairText {
  left: Type;
  right: Type;
}


// "{A = B, ...}", "∅", or a union of these — where C₁, C₂, ... stand for the constraint sets of the
// premises, in order ("C₁ ∪ C₂ ∪ {T₁ = T₂ → X}").
export function parseConstraintsText(
  text: string,
  premiseSets: (ConstraintPairText[] | undefined)[] = [],
  definitions: Definitions = NO_DEFINITIONS,
  expanding: readonly number[] = [],
): ConstraintPairText[] {
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

function splitEquation(item: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < item.length; i++) {
    const ch = item[i];
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "=" && depth === 0 && item[i + 1] !== ">" && item[i - 1] !== "<") {
      return [item.slice(0, i), item.slice(i + 1)];
    }
  }
  return null;
}

export type ParsedFact =
  | {form: "membership"; name: string; type: Type}
  | {form: "instantiate"; name: string; scheme: Type}
  | {form: "generalize"; type: Type; scheme: Type};

const MEMBER_SPLIT = /\s*(?:∈|\\in\b)\s*/;

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

export function parseFactText(text: string): ParsedFact {
  const source = text.trim().replace(/\\mathit\{(\w+)\}/g, "$1");

  const call = /^(generalize|instantiate)\s*\(/.exec(source);
  if (call) {
    const parts = balancedInside(source, call[0].length - 1);
    if (!parts) throw new ManualParseError("unbalanced parentheses");
    if (call[1] === "instantiate") {
      const [binding] = parts.inside.split(MEMBER_SPLIT);
      const colon = binding.indexOf(":");
      if (colon < 0) throw new ManualParseError('expected "instantiate(x : scheme ∈ Γ)"');
      return {form: "instantiate", name: binding.slice(0, colon).trim(), scheme: parseTypeText(binding.slice(colon + 1))};
    }
    const args = splitTopLevel(parts.inside, ",");
    const rest = parts.rest.trim();
    if (args.length < 1 || !rest.startsWith("=")) throw new ManualParseError('expected "generalize(T, Γ) = scheme"');
    return {form: "generalize", type: parseTypeText(args[0]), scheme: parseTypeText(rest.slice(1))};
  }

  const [binding, context] = source.split(MEMBER_SPLIT);
  const colon = binding.indexOf(":");
  if (colon < 0 || context === undefined) throw new ManualParseError('expected "x : T ∈ Γ"');
  return {form: "membership", name: binding.slice(0, colon).trim(), type: parseTypeText(binding.slice(colon + 1))};
}
