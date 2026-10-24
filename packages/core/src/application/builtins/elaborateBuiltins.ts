import type {App, BinOp, Program, Term} from "@/domain/ast";
import {elaborateNbl} from "@/application/nbl/elaborateNbl.ts";
import {isStlcBuiltin, type StlcBuiltinName, type TypeTheoryConfig} from "@/domain/typeTheory.ts";

export const BUILTIN_ARITY: Record<StlcBuiltinName, 1 | 2> = {succ: 1, pred: 1, iszero: 1, not: 1, and: 2, or: 2};

const UNARY = {succ: "Succ", pred: "Pred", iszero: "IsZero", not: "Not"} as const;

const TERM_KINDS: Record<Term["kind"], true> = {
  Var: true, Abs: true, App: true, Lit: true, VariantCase: true, Inl: true, Inr: true, IfCondition: true, Case: true,
  Variant: true, Ascribe: true, TupleProjection: true, RecordProjection: true, Record: true, Sequencing: true,
  Tuple: true, DummyAbstraction: true, Let: true, BinOp: true, TypeAbs: true, TypeApp: true, Fix: true, Nil: true,
  Cons: true, IsNil: true, Head: true, Tail: true, Fold: true, Unfold: true, Succ: true, Pred: true, IsZero: true, Not: true,
};

const isTerm = (value: unknown): value is Term =>
  typeof value === "object" && value !== null && Object.hasOwn(TERM_KINDS, (value as {kind?: string}).kind ?? "");

function applyBuiltin(name: StlcBuiltinName, app: App, args: Term[]): Term {
  if (name === "and" || name === "or") {
    const node: BinOp = {kind: "BinOp", id: app.id, pos: app.pos, operator: name, left: args[0], right: args[1]};
    return node;
  }
  return {kind: UNARY[name], id: app.id, pos: app.pos, term: args[0]};
}

function elaborate(term: Term, bound: ReadonlySet<string>): Term {
  const under = (...names: string[]) => new Set([...bound, ...names]);

  switch (term.kind) {
    case "App": {
      const apps: App[] = [];
      let head: Term = term;
      while (head.kind === "App") {
        apps.unshift(head);
        head = head.func;
      }
      if (head.kind !== "Var" || !isStlcBuiltin(head.name) || bound.has(head.name)) break;
      const arity = BUILTIN_ARITY[head.name];
      // Too few arguments stays an application of the bare name, which the checker explains.
      if (apps.length < arity) break;
      let result = applyBuiltin(head.name, apps[arity - 1], apps.slice(0, arity).map((app) => elaborate(app.arg, bound)));
      for (const app of apps.slice(arity)) result = {...app, func: result, arg: elaborate(app.arg, bound)};
      return result;
    }
    case "Abs":
      return {...term, body: elaborate(term.body, under(term.param))};
    case "Let":
      return {...term, value: elaborate(term.value, bound), body: elaborate(term.body, under(term.name))};
    case "Case":
      return {
        ...term,
        variable: elaborate(term.variable, bound),
        inl: {...term.inl, term: elaborate(term.inl.term, under(term.inl.variable))},
        inr: {...term.inr, term: elaborate(term.inr.term, under(term.inr.variable))},
      };
    case "VariantCase":
      return {
        ...term,
        variable: elaborate(term.variable, bound),
        cases: term.cases.map((c) => ({...c, body: elaborate(c.body, under(c.variable))})),
      };
  }
  return mapSubterms(term, (sub) => elaborate(sub, bound));
}

// Rewrites direct sub-terms only (also inside arrays/plain objects such as elif branches); types are left alone.
function mapSubterms<T extends object>(node: T, fn: (term: Term) => Term): T {
  const mapValue = (value: unknown): unknown => {
    if (isTerm(value)) return fn(value);
    if (Array.isArray(value)) return value.map(mapValue);
    if (typeof value === "object" && value !== null && !("kind" in value)) return mapSubterms(value, fn);
    return value;
  };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) result[key] = key === "pos" ? value : mapValue(value);
  return result as T;
}

// Turns free uses of succ/pred/iszero/not/and/or into their operator nodes; a user's own binding of the name wins.
export function elaborateBuiltins(program: Program): Program {
  const globals = new Set(program.globals.flatMap((declaration) =>
    declaration.kind === "FunDecl" || declaration.kind === "VarDecl" ? [declaration.name] : []));
  return {
    ...program,
    globals: program.globals.map((declaration) =>
      declaration.kind === "FunDecl" ? {...declaration, value: elaborate(declaration.value, globals)} : declaration),
    term: program.term && elaborate(program.term, globals),
  };
}

// The elaboration matching the selected language: NBL's prefix operators, STLC's builtins, or none for untyped.
export function elaborateProgram(program: Program, theories: TypeTheoryConfig): Program {
  if (theories.nbl || theories.typedNbl) return elaborateNbl(program);
  if (theories.untyped) return program;
  return elaborateBuiltins(program);
}
