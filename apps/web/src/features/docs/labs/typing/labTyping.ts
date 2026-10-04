import {AntlrParserAdapter, elaborateNbl, ParseSyntaxError, type Program, type Term, type Type} from "@vladyslav005/tt-core";
import type {SyntaxGoal} from "@/features/proof-tree/components/syntax-builder/syntaxGoal.ts";

// Typed NBL + STLC checked against a stated type, so a failure sits where no rule applies (core unification blames the outer λ).

export type Ty = {kind: "base"; name: string} | {kind: "arrow"; from: Ty; to: Ty};

export const NBL_TYPING_RULES = ["T-True", "T-False", "T-Zero", "T-Succ", "T-Pred", "T-IsZero", "T-If"] as const;
export const STLC_TYPING_RULES = ["T-Var", "T-Abs", "T-App", ...NBL_TYPING_RULES] as const;

const BOOL: Ty = {kind: "base", name: "Bool"};
const NAT: Ty = {kind: "base", name: "Nat"};
const UNKNOWN: Ty = {kind: "base", name: "?"};

type Context = [string, Ty][];

export interface TypingProblem {
  code: "unbound" | "notFunction" | "argument" | "condition" | "branches" | "needsNat" | "unsupported" | "declaration";
  params?: Record<string, string>;
}

type Synth = {ok: true; type: Ty} | {ok: false; problem: TypingProblem};

export const sameType = (a: Ty, b: Ty): boolean =>
  a.kind === "base" ? b.kind === "base" && a.name === b.name : b.kind === "arrow" && sameType(a.from, b.from) && sameType(a.to, b.to);

export function printType(type: Ty): string {
  if (type.kind === "base") return type.name;
  const from = type.from.kind === "arrow" ? `(${printType(type.from)})` : printType(type.from);
  return `${from}→${printType(type.to)}`;
}

export function fromCoreType(type: Type | undefined): Ty | undefined {
  if (type?.kind === "TyIdentifier") return {kind: "base", name: type.name};
  if (type?.kind !== "TyArrow") return undefined;
  const from = fromCoreType(type.from);
  const to = fromCoreType(type.to);
  return from && to ? {kind: "arrow", from, to} : undefined;
}

const atomic = (term: Term) => term.kind === "Var" || term.kind === "Lit";

export function printTerm(term: Term): string {
  const wrap = (inner: Term) => (atomic(inner) ? printTerm(inner) : `(${printTerm(inner)})`);
  switch (term.kind) {
    case "Var": return term.name;
    case "Lit": return term.value;
    case "Abs": return `λ${term.param}:${term.paramType ? printType(fromCoreType(term.paramType) ?? UNKNOWN) : "?"}. ${printTerm(term.body)}`;
    case "App": return `${term.func.kind === "App" ? printTerm(term.func) : wrap(term.func)} ${wrap(term.arg)}`;
    case "Succ": return `succ ${wrap(term.term)}`;
    case "Pred": return `pred ${wrap(term.term)}`;
    case "IsZero": return `iszero ${wrap(term.term)}`;
    case "IfCondition": return `if ${printTerm(term.condition)} then ${printTerm(term.then)} else ${term.else ? printTerm(term.else) : "?"}`;
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
      if (term.value === "0") return {ok: true, type: NAT};
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
      return when(term.value === "0" && sameType(type, NAT), "T-Zero");
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
