import type {Program, Term} from "@/domain/ast";

// Collapsing only applies to pure λ-terms (untyped lambda calculus and its typed-λ subset).
export function isPureLambda(term: Term): boolean {
  switch (term.kind) {
    case "Var": return true;
    case "Abs": return isPureLambda(term.body);
    case "App": return isPureLambda(term.func) && isPureLambda(term.arg);
    default: return false;
  }
}

export function freeVariables(term: Term, bound: ReadonlySet<string> = new Set(), into = new Set<string>()): Set<string> {
  switch (term.kind) {
    case "Var":
      if (!bound.has(term.name)) into.add(term.name);
      break;
    case "Abs":
      freeVariables(term.body, new Set([...bound, term.param]), into);
      break;
    case "App":
      freeVariables(term.func, bound, into);
      freeVariables(term.arg, bound, into);
      break;
  }
  return into;
}

// `x x` — what Y, fixx and Ω are built from.
export function hasSelfApplication(term: Term): boolean {
  switch (term.kind) {
    case "App":
      return (term.func.kind === "Var" && term.arg.kind === "Var" && term.func.name === term.arg.name)
        || hasSelfApplication(term.func) || hasSelfApplication(term.arg);
    case "Abs":
      return hasSelfApplication(term.body);
    default:
      return false;
  }
}

export function arity(term: Term): number {
  let count = 0;
  while (term.kind === "Abs") {
    count += 1;
    term = term.body;
  }
  return count;
}

export function alphaEqual(a: Term, b: Term, left = new Map<string, number>(), right = new Map<string, number>(), depth = 0): boolean {
  if (a.kind === "Var" && b.kind === "Var") {
    const la = left.get(a.name);
    const rb = right.get(b.name);
    return la === undefined && rb === undefined ? a.name === b.name : la === rb;
  }
  if (a.kind === "Abs" && b.kind === "Abs") {
    return alphaEqual(a.body, b.body, new Map(left).set(a.param, depth), new Map(right).set(b.param, depth), depth + 1);
  }
  if (a.kind === "App" && b.kind === "App") {
    return alphaEqual(a.func, b.func, left, right, depth) && alphaEqual(a.arg, b.arg, left, right, depth);
  }
  return false;
}

// A definition is recursive when it applies something to itself, refers to itself, or uses a recursive definition.
export function recursiveGlobals(globals: ReadonlyMap<string, Term>): Set<string> {
  const references = new Map<string, Set<string>>();
  for (const [name, value] of globals) {
    references.set(name, new Set([...freeVariables(value)].filter((ref) => globals.has(ref))));
  }
  const recursive = new Set<string>();
  for (const [name, value] of globals) {
    if (hasSelfApplication(value) || references.get(name)!.has(name)) recursive.add(name);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, refs] of references) {
      if (!recursive.has(name) && [...refs].some((ref) => recursive.has(ref))) {
        recursive.add(name);
        changed = true;
      }
    }
  }
  return recursive;
}

function programGlobals(program: Program): Map<string, Term> {
  const globals = new Map<string, Term>();
  for (const decl of program.globals) {
    if (decl.kind === "FunDecl" || decl.kind === "VarDecl") globals.set(decl.name, decl.value);
  }
  return globals;
}

export interface HelperCandidate {
  name: string;
  recursive: boolean;
}

// Definitions the user can pick as black boxes: pure λ-functions taking at least one argument.
export function helperCandidates(program: Program): HelperCandidate[] {
  const globals = programGlobals(program);
  const recursive = recursiveGlobals(globals);
  return [...globals]
    .filter(([, value]) => isPureLambda(value) && arity(value) > 0)
    .map(([name]) => ({name, recursive: recursive.has(name)}));
}

export type Normalizer = (term: Term, bound: ReadonlySet<string>) => {term: Term; steps: number} | undefined;

export class HelperCollapse {
  readonly recursive: Set<string>;
  // Calls that didn't reach a normal form within the budget — stepped normally instead.
  readonly failed = new Set<string>();
  private readonly arities = new Map<string, number>();
  private foldTargets?: {name: string; normalForm: Term}[];

  constructor(
    readonly globals: ReadonlyMap<string, Term>,
    readonly names: ReadonlySet<string>,
    private readonly normalize: Normalizer,
  ) {
    this.recursive = recursiveGlobals(globals);
    for (const [name, value] of globals) this.arities.set(name, isPureLambda(value) ? arity(value) : -1);
  }

  arity(name: string): number {
    return this.arities.get(name) ?? -1;
  }

  // Closed (only global names free), pure, and with no recursion machinery inside.
  isPlainArgument(term: Term, bound: ReadonlySet<string>): boolean {
    if (!isPureLambda(term) || hasSelfApplication(term)) return false;
    return [...freeVariables(term)].every((name) => !bound.has(name) && this.globals.has(name) && !this.recursive.has(name));
  }

  run(term: Term, bound: ReadonlySet<string>) {
    return this.normalize(term, bound);
  }

  // Shows a result by the name of a definition it equals, preferring names the helper's definition mentions
  // (iszero's fls, pred's zero — the two are the same λ-term), then names in its arguments.
  nameFor(result: Term, head: string, args: Term[], bound: ReadonlySet<string>): string | undefined {
    this.foldTargets ??= [...this.globals]
      .filter(([name, value]) => !this.recursive.has(name) && isPureLambda(value))
      .flatMap(([name, value]) => {
        const normal = this.normalize(value, new Set());
        return normal ? [{name, normalForm: normal.term}] : [];
      });
    const matches = this.foldTargets
      .filter((target) => !bound.has(target.name) && alphaEqual(target.normalForm, result))
      .map((target) => target.name);
    if (matches.length <= 1) return matches[0];
    const inDefinition = freeVariables(this.globals.get(head)!);
    const inArguments = new Set<string>();
    for (const arg of args) freeVariables(arg, new Set(), inArguments);
    return matches.find((name) => inDefinition.has(name)) ?? matches.find((name) => inArguments.has(name)) ?? matches[0];
  }
}
