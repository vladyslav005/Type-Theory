import {AntlrParserAdapter, elaborateNbl, ParseSyntaxError, typeToString, type Program, type Term, type Type} from "@vladyslav005/tt-core";
import type {SyntaxGoal} from "@/features/proof-tree/components/syntax-builder/syntaxGoal.ts";

// Typed NBL + STLC (with let and products) checked against a stated type, so a failure sits where no rule applies (core unification blames the outer λ).

export type Ty =
  | {kind: "base"; name: string}
  | {kind: "arrow"; from: Ty; to: Ty}
  | {kind: "tuple"; elements: Ty[]}
  | {kind: "record"; fields: {label: string; type: Ty}[]};

export const NBL_TYPING_RULES = ["T-True", "T-False", "T-Zero", "T-Succ", "T-Pred", "T-IsZero", "T-If"] as const;
export const STLC_TYPING_RULES = ["T-Var", "T-Abs", "T-App", ...NBL_TYPING_RULES] as const;
export const PRODUCT_TYPING_RULES = [...STLC_TYPING_RULES, "T-Nat", "T-Let", "T-Tuple", "T-Proj", "T-Record", "T-RecordProj"] as const;

const BOOL: Ty = {kind: "base", name: "Bool"};
const NAT: Ty = {kind: "base", name: "Nat"};
const UNKNOWN: Ty = {kind: "base", name: "?"};

type Context = [string, Ty][];

export interface TypingProblem {
  code: "unbound" | "notFunction" | "argument" | "condition" | "branches" | "needsNat" | "unsupported" | "declaration"
    | "notTuple" | "tupleIndex" | "notRecord" | "noField";
  params?: Record<string, string>;
}

type Synth = {ok: true; type: Ty} | {ok: false; problem: TypingProblem};

export function sameType(a: Ty, b: Ty): boolean {
  switch (a.kind) {
    case "base": return b.kind === "base" && a.name === b.name;
    case "arrow": return b.kind === "arrow" && sameType(a.from, b.from) && sameType(a.to, b.to);
    case "tuple": return b.kind === "tuple" && a.elements.length === b.elements.length && a.elements.every((t, i) => sameType(t, b.elements[i]));
    case "record":
      return b.kind === "record" && a.fields.length === b.fields.length
        && a.fields.every((f, i) => f.label === b.fields[i].label && sameType(f.type, b.fields[i].type));
  }
}

export function printType(type: Ty): string {
  switch (type.kind) {
    case "base": return type.name;
    case "tuple": return `<${type.elements.map(printType).join(" * ")}>`;
    case "record": return `<${type.fields.map((f) => `${f.label} : ${printType(f.type)}`).join(", ")}>`;
    case "arrow": {
      const from = type.from.kind === "arrow" ? `(${printType(type.from)})` : printType(type.from);
      return `${from}→${printType(type.to)}`;
    }
  }
}

const allDefined = <T>(items: (T | undefined)[]): T[] | undefined => (items.every((item) => item !== undefined) ? items as T[] : undefined);

export function fromCoreType(type: Type | undefined): Ty | undefined {
  switch (type?.kind) {
    case "TyIdentifier": return {kind: "base", name: type.name};
    case "TyArrow": {
      const from = fromCoreType(type.from);
      const to = fromCoreType(type.to);
      return from && to ? {kind: "arrow", from, to} : undefined;
    }
    case "TupleType": {
      const elements = allDefined(type.elements.map(fromCoreType));
      return elements && {kind: "tuple", elements};
    }
    case "RecordType": {
      const types = allDefined(type.fields.map((f) => fromCoreType(f.type)));
      return types && {kind: "record", fields: type.fields.map((f, i) => ({label: f.label, type: types[i]}))};
    }
    default: return undefined;
  }
}

const atomic = (term: Term) => ["Var", "Lit", "Tuple", "Record", "TupleProjection", "RecordProjection"].includes(term.kind);

const printAnyType = (type: Type) => {
  const known = fromCoreType(type);
  return known ? printType(known) : typeToString(type);
};

export function printTerm(term: Term): string {
  const wrap = (inner: Term) => (atomic(inner) ? printTerm(inner) : `(${printTerm(inner)})`);
  switch (term.kind) {
    case "Var": return term.name;
    case "Lit": return term.value;
    case "Abs": return `λ${term.param}:${term.paramType ? printAnyType(term.paramType) : "?"}. ${printTerm(term.body)}`;
    case "App": return `${term.func.kind === "App" ? printTerm(term.func) : wrap(term.func)} ${wrap(term.arg)}`;
    case "Succ": return `succ ${wrap(term.term)}`;
    case "Pred": return `pred ${wrap(term.term)}`;
    case "IsZero": return `iszero ${wrap(term.term)}`;
    case "IfCondition": return `if ${printTerm(term.condition)} then ${printTerm(term.then)} else ${term.else ? printTerm(term.else) : "?"}`;
    case "Let": return `let ${term.name} = ${printTerm(term.value)} in ${printTerm(term.body)}`;
    case "Tuple": return `<${term.elements.map(printTerm).join(", ")}>`;
    case "Record": return `<${term.fields.map((f) => `${f.label} = ${printTerm(f.term)}`).join(", ")}>`;
    case "TupleProjection": return `${wrap(term.tuple)}.${term.index}`;
    case "RecordProjection": return `${wrap(term.term)}.${term.label}`;
    case "Inl": return `inl ${wrap(term.term)} as ${printAnyType(term.type)}`;
    case "Inr": return `inr ${wrap(term.term)} as ${printAnyType(term.type)}`;
    case "Variant": return `${term.variants.map((v) => `[${v.label} = ${printTerm(v.term)}]`).join(" ")} as ${printAnyType(term.type)}`;
    case "Ascribe": return `${wrap(term.term)} as ${printAnyType(term.type)}`;
    case "Case": return `case ${printTerm(term.variable)} || inl ${term.inl.variable} => ${printTerm(term.inl.term)} || inr ${term.inr.variable} => ${printTerm(term.inr.term)}`;
    case "VariantCase": return `case ${printTerm(term.variable)} of ${term.cases.map((c) => `[${c.label} = ${c.variable}] => ${printTerm(c.body)}`).join(" || ")}`;
    default: return term.kind;
  }
}

const lookup = (context: Context, name: string) => [...context].reverse().find(([bound]) => bound === name)?.[1];
const extend = (context: Context, name: string, type: Ty): Context => [...context, [name, type]];

export function synthesize(term: Term, context: Context): Synth {
  const fail = (code: TypingProblem["code"], params?: Record<string, string>): Synth => ({ok: false, problem: {code, params}});
  const expect = (inner: Term, type: Ty, onWrong: (actual: Ty) => Synth): Synth | undefined => {
    const result = synthesize(inner, context);
    if (!result.ok) return result;
    return sameType(result.type, type) ? undefined : onWrong(result.type);
  };
  switch (term.kind) {
    case "Var": {
      const type = lookup(context, term.name);
      return type ? {ok: true, type} : fail("unbound", {name: term.name});
    }
    case "Lit":
      if (term.value === "true" || term.value === "false") return {ok: true, type: BOOL};
      if (/^\d+$/.test(term.value)) return {ok: true, type: NAT};
      return fail("unsupported", {construct: term.value});
    case "Succ":
    case "Pred":
      return expect(term.term, NAT, (actual) => fail("needsNat", {term: printTerm(term.term), type: printType(actual)})) ?? {ok: true, type: NAT};
    case "IsZero":
      return expect(term.term, NAT, (actual) => fail("needsNat", {term: printTerm(term.term), type: printType(actual)})) ?? {ok: true, type: BOOL};
    case "IfCondition": {
      if (!term.else || term.elif?.length) return fail("unsupported", {construct: "if"});
      const condition = expect(term.condition, BOOL, (actual) => fail("condition", {type: printType(actual)}));
      if (condition) return condition;
      const then = synthesize(term.then, context);
      if (!then.ok) return then;
      const otherwise = synthesize(term.else, context);
      if (!otherwise.ok) return otherwise;
      return sameType(then.type, otherwise.type) ? then : fail("branches", {then: printType(then.type), else: printType(otherwise.type)});
    }
    case "Abs": {
      const param = fromCoreType(term.paramType);
      if (!param) return fail("unsupported", {construct: `λ${term.param}`});
      const body = synthesize(term.body, extend(context, term.param, param));
      return body.ok ? {ok: true, type: {kind: "arrow", from: param, to: body.type}} : body;
    }
    case "App": {
      const func = synthesize(term.func, context);
      if (!func.ok) return func;
      if (func.type.kind !== "arrow") return fail("notFunction", {term: printTerm(term.func), type: printType(func.type)});
      const {from, to} = func.type;
      return expect(term.arg, from, (actual) => fail("argument", {term: printTerm(term.arg), expected: printType(from), actual: printType(actual)})) ?? {ok: true, type: to};
    }
    case "Let": {
      const value = synthesize(term.value, context);
      return value.ok ? synthesize(term.body, extend(context, term.name, value.type)) : value;
    }
    case "Tuple": {
      const elements: Ty[] = [];
      for (const element of term.elements) {
        const typed = synthesize(element, context);
        if (!typed.ok) return typed;
        elements.push(typed.type);
      }
      return {ok: true, type: {kind: "tuple", elements}};
    }
    case "Record": {
      const fields: {label: string; type: Ty}[] = [];
      for (const field of term.fields) {
        const typed = synthesize(field.term, context);
        if (!typed.ok) return typed;
        fields.push({label: field.label, type: typed.type});
      }
      return {ok: true, type: {kind: "record", fields}};
    }
    case "TupleProjection": {
      const tuple = synthesize(term.tuple, context);
      if (!tuple.ok) return tuple;
      if (tuple.type.kind !== "tuple") return fail("notTuple", {term: printTerm(term.tuple), type: printType(tuple.type)});
      const element = tuple.type.elements[term.index - 1];
      return element ? {ok: true, type: element} : fail("tupleIndex", {index: String(term.index), type: printType(tuple.type)});
    }
    case "RecordProjection": {
      const record = synthesize(term.term, context);
      if (!record.ok) return record;
      if (record.type.kind !== "record") return fail("notRecord", {term: printTerm(term.term), type: printType(record.type)});
      const field = record.type.fields.find((f) => f.label === term.label);
      return field ? {ok: true, type: field.type} : fail("noField", {label: term.label, type: printType(record.type)});
    }
    default:
      return fail("unsupported", {construct: term.kind});
  }
}

export interface TypingJudgement {
  context: Context;
  term: Term;
  type: Ty;
}

export function printJudgement({context, term, type}: TypingJudgement, showContext: boolean): string {
  const gamma = !showContext ? "" : context.length === 0 ? "∅ " : `${context.map(([name, t]) => `${name}:${printType(t)}`).join(", ")} `;
  return `${gamma}⊢ ${printTerm(term)} : ${printType(type)}`;
}

// The derivation of `context ⊢ term : type`; a node's rule is undefined where none applies.
export function typingGoal(judgement: TypingJudgement, showContext: boolean, key = "r"): SyntaxGoal {
  const {context, term, type} = judgement;
  const node = (rule: string | undefined, premises: TypingJudgement[] = []): SyntaxGoal => ({
    key,
    judgement: printJudgement(judgement, showContext),
    rule,
    children: premises.map((premise, i) => typingGoal(premise, showContext, `${key}.${i}`)),
  });
  const premise = (inner: Term, innerType: Ty, innerContext = context): TypingJudgement => ({context: innerContext, term: inner, type: innerType});
  const when = (fits: boolean, rule: string, premises: TypingJudgement[] = []) => (fits ? node(rule, premises) : node(undefined));

  switch (term.kind) {
    case "Lit":
      if (term.value === "true") return when(sameType(type, BOOL), "T-True");
      if (term.value === "false") return when(sameType(type, BOOL), "T-False");
      if (term.value === "0") return when(sameType(type, NAT), "T-Zero");
      return when(/^\d+$/.test(term.value) && sameType(type, NAT), "T-Nat");
    case "Succ": return when(sameType(type, NAT), "T-Succ", [premise(term.term, NAT)]);
    case "Pred": return when(sameType(type, NAT), "T-Pred", [premise(term.term, NAT)]);
    case "IsZero": return when(sameType(type, BOOL), "T-IsZero", [premise(term.term, NAT)]);
    case "IfCondition":
      return when(!!term.else && !term.elif?.length, "T-If", term.else ? [premise(term.condition, BOOL), premise(term.then, type), premise(term.else, type)] : []);
    case "Var": {
      const bound = lookup(context, term.name);
      return when(!!bound && sameType(bound, type), "T-Var");
    }
    case "Abs": {
      const param = fromCoreType(term.paramType);
      const fits = !!param && type.kind === "arrow" && sameType(type.from, param);
      return when(fits, "T-Abs", fits && type.kind === "arrow" ? [premise(term.body, type.to, extend(context, term.param, param!))] : []);
    }
    case "App": {
      const func = synthesize(term.func, context);
      if (func.ok) {
        // The function's type is fixed by its own derivation, so T-App fits only if it is T₁ → T.
        const fits = func.type.kind === "arrow" && sameType(func.type.to, type);
        return when(fits, "T-App", func.type.kind === "arrow" ? [premise(term.func, func.type), premise(term.arg, func.type.from)] : []);
      }
      // The function is ill-typed itself: T-App still fits, and the failure is further up its premise.
      const arg = synthesize(term.arg, context);
      const from = arg.ok ? arg.type : UNKNOWN;
      return node("T-App", [premise(term.func, {kind: "arrow", from, to: type}), premise(term.arg, from)]);
    }
    case "Let": {
      const value = synthesize(term.value, context);
      const bound = value.ok ? value.type : UNKNOWN;
      return node("T-Let", [premise(term.value, bound), premise(term.body, type, extend(context, term.name, bound))]);
    }
    case "Tuple": {
      const fits = type.kind === "tuple" && type.elements.length === term.elements.length;
      return when(fits, "T-Tuple", fits ? term.elements.map((element, i) => premise(element, type.elements[i])) : []);
    }
    case "Record": {
      const fits = type.kind === "record" && type.fields.length === term.fields.length && type.fields.every((f, i) => f.label === term.fields[i].label);
      return when(fits, "T-Record", fits ? term.fields.map((field, i) => premise(field.term, type.fields[i].type)) : []);
    }
    case "TupleProjection": {
      // As with T-App, the tuple's type comes from its own derivation.
      const tuple = synthesize(term.tuple, context);
      if (!tuple.ok) return node("T-Proj", [premise(term.tuple, UNKNOWN)]);
      const fits = tuple.type.kind === "tuple" && !!tuple.type.elements[term.index - 1] && sameType(tuple.type.elements[term.index - 1], type);
      return when(fits, "T-Proj", [premise(term.tuple, tuple.type)]);
    }
    case "RecordProjection": {
      const record = synthesize(term.term, context);
      if (!record.ok) return node("T-RecordProj", [premise(term.term, UNKNOWN)]);
      const field = record.type.kind === "record" ? record.type.fields.find((f) => f.label === term.label) : undefined;
      return when(!!field && sameType(field.type, type), "T-RecordProj", [premise(term.term, record.type)]);
    }
    default:
      return node(undefined);
  }
}

export const firstProblem = (goal: SyntaxGoal): SyntaxGoal | undefined =>
  goal.rule === undefined ? goal : goal.children.map(firstProblem).find(Boolean);

const parser = new AntlrParserAdapter();

const messageOf = (error: unknown) =>
  error instanceof ParseSyntaxError ? error.errors[0]?.message ?? error.message : error instanceof Error ? error.message : String(error);

export function parseProgram(text: string): {ok: true; program: Program} | {ok: false; message: string} {
  try {
    return {ok: true, program: elaborateNbl(parser.parseExpression(`${text.trim().replace(/;\s*$/, "")};`))};
  } catch (error) {
    return {ok: false, message: messageOf(error)};
  }
}

export const parseTerm = (text: string): Term | undefined => {
  const parsed = parseProgram(text);
  return parsed.ok ? parsed.program.term : undefined;
};

// Declarations (`x : T;` or `f = t : T;`) build the context the final term is checked in.
export function contextOf(program: Program): {ok: true; context: Context} | {ok: false; problem: TypingProblem} {
  let context: Context = [];
  for (const declaration of program.globals) {
    if (declaration.kind !== "VarDecl" && declaration.kind !== "FunDecl") return {ok: false, problem: {code: "unsupported", params: {construct: declaration.kind}}};
    const type = fromCoreType(declaration.type);
    if (!type) return {ok: false, problem: {code: "unsupported", params: {construct: declaration.name}}};
    if (declaration.kind === "FunDecl") {
      const value = synthesize(declaration.value, context);
      if (!value.ok) return value;
      if (!sameType(value.type, type)) return {ok: false, problem: {code: "declaration", params: {name: declaration.name, expected: printType(type), actual: printType(value.type)}}};
    }
    context = extend(context, declaration.name, type);
  }
  return {ok: true, context};
}

export interface TypingTerm {
  program: Program;
  term: Term;
  type: Ty;
  context: Context;
}

// `source` is `term : Type`; `contextSource` holds declarations such as `and : Bool -> Bool -> Bool`.
export function readTypingTerm(source: string, contextSource = ""): {ok: true; value: TypingTerm} | {ok: false; message: string} {
  const parsed = parseProgram(contextSource ? `${contextSource.replace(/;?\s*$/, ";")}\n${source}` : source);
  if (!parsed.ok) return parsed;
  const {program} = parsed;
  const type = fromCoreType(program.termType);
  const context = contextOf(program);
  if (!program.term || !type || !context.ok) return {ok: false, message: "the task needs a term with its stated type"};
  return {ok: true, value: {program, term: program.term, type, context: context.context}};
}
