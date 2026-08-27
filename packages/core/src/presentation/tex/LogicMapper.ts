import type {ProofTree} from "@/application/typecheck/ProofTree.ts";
import {Rule} from "@/application/typecheck/ProofTree.ts";
import type {TexSegment, TexTree} from "@/presentation/tex/texTree.ts";
import type {Type} from "@/domain/ast";
import {TexMapper} from "@/presentation/tex/TexMapper.ts";
import {GammaRegistry} from "@/presentation/tex/GammaRegistry.ts";
import {TypeAliasRegistry} from "@/presentation/tex/TypeAliasRegistry.ts";

const CONNECTIVE_RULES: ReadonlySet<Rule> = new Set([
  Rule.Var, Rule.Abs, Rule.DummyAbs, Rule.App, Rule.Tuple, Rule.TupleProjection, Rule.Inl, Rule.Inr, Rule.Case,
]);

// Every rule tag that only a type-theory extension can produce: Fold/Unfold (iso-recursive),
// TypeAbs/TypeApp (System F), TyConstructorAbs/App (System Fω), TPiApp (System λP), and the whole
// Ct-prefixed family (constraint-based checking, emitted once type inference or let-polymorphism
// is generalizing/inferring). A tree containing any of these has no clean Curry-Howard reading.
const NON_STLC_RULES: ReadonlySet<Rule> = new Set([
  Rule.Fold, Rule.Unfold,
  Rule.TypeAbs, Rule.TypeApp,
  Rule.TyConstructorAbs, Rule.TyConstructorApp,
  Rule.TPiApp,
  Rule.CtVarLet, Rule.CtVar, Rule.CtAbs, Rule.CtAbsInf, Rule.CtApp, Rule.CtLit, Rule.CtIf,
  Rule.CtInl, Rule.CtInr, Rule.CtCase, Rule.CtVariantCase, Rule.CtVariant, Rule.CtAscribe,
  Rule.CtTuple, Rule.CtTupleProjection, Rule.CtRecord, Rule.CtRecordProjection,
  Rule.CtSequencing, Rule.CtDummyAbs, Rule.CtLet, Rule.CtBinOp, Rule.CtFix,
  Rule.CtNil, Rule.CtCons, Rule.CtIsNil, Rule.CtHead, Rule.CtTail, Rule.CtFold, Rule.CtUnfold,
]);

// A kindPremise (Δ ⊢ T :: K) only ever gets attached once a type mentions a λω̲ constructor or a
// Π-type, i.e. only under System Fω / System λP — so its mere presence marks the proof impure too.
export function isPlainStlcProof(node: ProofTree): boolean {
  if (NON_STLC_RULES.has(node.rule)) return false;
  if (node.kindPremise) return false;
  return node.premises.every(isPlainStlcProof);
}

// Thrown by LogicMapper when asked to map a proof that isn't plain STLC — callers should treat
// this the same as "no logic tree available" rather than let a mismatched theory render through.
export class NonStlcProofError extends Error {
  constructor() {
    super("Cannot render a Curry-Howard logic tree for a proof that uses non-STLC type rules.");
    this.name = "NonStlcProofError";
  }
}

function isUnitLit(node: ProofTree): boolean {
  const value = (node.term as any).value;
  return node.rule === Rule.Lit && (value === "unit" || value === "Unit");
}

const COMPOUND_KINDS = new Set(["TyArrow", "TupleType", "SumType"]);

// Reads a checked Type as the proposition it corresponds to under Curry-Howard: -> is
// implication, an n-ary tuple is conjunction, a sum is disjunction, Unit is truth. Anything
// without a clean propositional reading (records, variants, lists, ...) falls back to its
// ordinary type rendering.
function propositionToTex(type: Type): string {
  const wrap = (t: Type) => COMPOUND_KINDS.has(t.kind) ? `(${propositionToTex(t)})` : propositionToTex(t);

  switch (type.kind) {
    case "TyIdentifier":
      return type.name === "Unit" ? "\\top" : type.name;
    case "TyArrow":
      return `${wrap(type.from)} \\Rightarrow ${wrap(type.to)}`;
    case "TupleType":
      return type.elements.length > 0 ? type.elements.map(wrap).join(" \\land ") : "\\top";
    case "SumType":
      return `${wrap(type.left)} \\lor ${wrap(type.right)}`;
    default:
      return TexMapper.typeToTex(type);
  }
}

// Renders a typing derivation as a natural-deduction proof: same Γ/term, but the connective
// rules (Var/Abs/App/Tuple/TupleProjection/Inl/Inr/Case, plus the Unit literal) get logic-style
// labels and propositions instead of T-rule labels and types. Everything else falls back to TexMapper.
export class LogicMapper {

  private readonly gammaRegistry: GammaRegistry;
  private registryBuilt = false;
  private typeAliasRegistry: TypeAliasRegistry;

  constructor(typeAliasRegistry: TypeAliasRegistry = new TypeAliasRegistry({}), gammaRegistry: GammaRegistry = new GammaRegistry()) {
    this.typeAliasRegistry = typeAliasRegistry;
    this.gammaRegistry = gammaRegistry;
  }

  setTypeAliases(aliases: { [name: string]: Type }): void {
    this.typeAliasRegistry = new TypeAliasRegistry(aliases);
    this.gammaRegistry.reset();
    this.registryBuilt = false;
  }

  visit(node: ProofTree): TexTree {
    if (!this.registryBuilt) {
      if (!isPlainStlcProof(node)) throw new NonStlcProofError();
      this.buildGammaRegistry(node, null);
      this.registryBuilt = true;
    }

    const tex = this.dispatch(node);
    if (node.error) tex.error = node.error;
    tex.id = node.id;
    return tex;
  }

  private buildGammaRegistry(node: ProofTree, parent: ProofTree | null): void {
    this.gammaRegistry.register(node.gamma, parent?.gamma ?? null);
    for (const premise of node.premises) {
      this.buildGammaRegistry(premise, node);
    }
  }

  private dispatch(node: ProofTree): TexTree {
    if (isUnitLit(node)) {
      return {...this.judgements(node), rule: "⊤I", children: []};
    }
    if (!CONNECTIVE_RULES.has(node.rule)) {
      return new TexMapper(this.typeAliasRegistry, this.gammaRegistry).visit(node);
    }

    switch (node.rule) {
      case Rule.Var:
        return this.visitVar(node);
      case Rule.Abs:
      case Rule.DummyAbs:
        return {...this.judgements(node), rule: "⇒I", children: node.premises.map((p) => this.visit(p))};
      case Rule.App:
        return {...this.judgements(node), rule: "⇒E", children: node.premises.map((p) => this.visit(p))};
      case Rule.Tuple:
        return {...this.judgements(node), rule: "∧I", children: node.premises.map((p) => this.visit(p))};
      case Rule.TupleProjection:
        return {...this.judgements(node), rule: "∧E", children: node.premises.map((p) => this.visit(p))};
      case Rule.Inl:
        return {...this.judgements(node), rule: "∨I₁", children: node.premises.map((p) => this.visit(p))};
      case Rule.Inr:
        return {...this.judgements(node), rule: "∨I₂", children: node.premises.map((p) => this.visit(p))};
      case Rule.Case:
        return {...this.judgements(node), rule: "∨E", children: node.premises.map((p) => this.visit(p))};
      default:
        return new TexMapper(this.typeAliasRegistry, this.gammaRegistry).visit(node);
    }
  }

  private visitVar(node: ProofTree): TexTree {
    if (node.premises.length > 0) {
      return {
        ...this.judgements(node),
        rule: "Lemma",
        meta: (node.term as any).name as string,
        children: node.premises.map((p) => this.visit(p)),
        collapsedRule: "Ax",
        collapsedChildren: [this.hypothesisTex(node)],
      };
    }
    return {...this.judgements(node), rule: "Ax", children: [this.hypothesisTex(node)]};
  }

  private hypothesisTex(node: ProofTree): TexTree {
    const prop = propositionToTex(node.type);
    const gammaRef = this.gammaRegistry.refFor(node.gamma);
    const gammaTex = gammaRef ? gammaRef.shortTex : "\\Gamma";
    const gammaSeg: TexSegment = gammaRef ? {kind: "ref", key: gammaRef.key} : {kind: "tex", value: "\\Gamma"};

    return {
      id: `${node.id}-hypothesis`,
      judgement: `${prop} \\in ${gammaTex}`,
      judgementSegments: [{kind: "tex", value: `${prop} \\in `}, gammaSeg],
      registry: this.gammaRegistry.registry,
      rule: "",
    };
  }

  // Pure Γ ⊢ φ sequents — no witnessing term, matching the natural-deduction presentation.
  private judgements(node: ProofTree): Pick<TexTree, "judgement" | "judgementSegments" | "registry"> {
    const gammaRef = this.gammaRegistry.refFor(node.gamma);
    const prop = propositionToTex(node.type);
    const gammaTex = gammaRef ? gammaRef.shortTex : "\\emptyset";
    const gammaSeg: TexSegment = gammaRef ? {kind: "ref", key: gammaRef.key} : {kind: "tex", value: "\\emptyset"};

    return {
      judgement: `${gammaTex} \\vdash ${prop}`,
      judgementSegments: [gammaSeg, {kind: "tex", value: ` \\vdash ${prop}`}],
      registry: this.gammaRegistry.registry,
    };
  }
}
