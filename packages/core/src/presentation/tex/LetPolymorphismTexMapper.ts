import type {TexRegistryEntry, TexSegment, TexTree} from "@/presentation/tex/texTree.ts";
import {type Constraint, type InferProofTree, type KindProofTree, type ProofTree, Rule} from "@/application/typecheck/ProofTree.ts";
import {TexMapper} from "@/presentation/tex/TexMapper.ts";
import {GammaRegistry, type ContextValue, type SetRegistration} from "@/presentation/tex/GammaRegistry.ts";
import {TypeAliasRegistry} from "@/presentation/tex/TypeAliasRegistry.ts";

// The rules produced by the constraint-typing (CT) judgment — kept separate from TexMapper's plain "T-*" set.
export const CT_RULES: ReadonlySet<Rule> = new Set([
  Rule.CtVar,
  Rule.CtVarLet,
  Rule.CtAbs,
  Rule.CtAbsInf,
  Rule.CtApp,
  Rule.CtLit,
  Rule.CtIf,
  Rule.CtInl,
  Rule.CtInr,
  Rule.CtCase,
  Rule.CtVariantCase,
  Rule.CtVariant,
  Rule.CtAscribe,
  Rule.CtTuple,
  Rule.CtTupleProjection,
  Rule.CtRecord,
  Rule.CtRecordProjection,
  Rule.CtSequencing,
  Rule.CtDummyAbs,
  Rule.CtLet,
  Rule.CtBinOp,
  Rule.CtFix,
  Rule.CtNil,
  Rule.CtCons,
  Rule.CtIsNil,
  Rule.CtHead,
  Rule.CtTail,
  Rule.CtFold,
  Rule.CtUnfold,
]);

// Renders CT proof trees into TexTree as "CT-*" rules, additionally showing each judgment's
// pending constraint set (Γ ⊢ t : T | C). A node whose rule isn't in CT_RULES delegates to TexMapper.
// Every distinct Γ/constraint-set is numbered the first time it appears (Γ_1, C_1, ...), with a
// "recipe" explaining how it was built, independently clickable via `registry`/`judgementSegments`.
export class LetPolymorphismTexMapper {

  private readonly registry: Record<string, TexRegistryEntry>;
  private readonly gammaRegistry: GammaRegistry;
  private readonly constraintsByRef: Map<Constraint[], SetRegistration>;
  private registryBuilt = false;

  // Shared with the TexMapper delegate so Γ_n/C_n numbering stays continuous across a `let` boundary.
  constructor(
    private readonly typeAliasRegistry: TypeAliasRegistry = new TypeAliasRegistry({}),
    gammaRegistry: GammaRegistry = new GammaRegistry(),
    registry: Record<string, TexRegistryEntry> = {},
    constraintsByRef: Map<Constraint[], SetRegistration> = new Map(),
  ) {
    this.gammaRegistry = gammaRegistry;
    this.registry = registry;
    this.constraintsByRef = constraintsByRef;
  }

  visit(node: ProofTree): TexTree {
    if (!CT_RULES.has(node.rule)) {
      return new TexMapper(this.typeAliasRegistry, this.gammaRegistry).visit(node);
    }

    if (!this.registryBuilt) {
      this.buildRegistry(node as InferProofTree, null);
      Object.assign(this.registry, this.gammaRegistry.registry, this.typeAliasRegistry.registry);
      this.registryBuilt = true;
    }

    const tex = this.dispatch(node as InferProofTree);
    if (node.error) tex.error = node.error;
    tex.id = node.id;
    tex.pos = node.term.pos;
    return tex;
  }

  // ===== registry building: one pass over the whole derivation ===========

  private buildRegistry(node: InferProofTree, parent: InferProofTree | null): void {
    this.gammaRegistry.register(node.gamma, parent?.gamma ?? null);

    if (node.kindPremise) {
      this.buildKindGammaRegistry(node.kindPremise, node.gamma);
    }

    for (const premise of node.premises) {
      this.buildRegistry(premise as InferProofTree, node);
    }

    this.registerConstraints(node);
  }

  // Mirrors TexMapper.buildKindGammaRegistry — Δ and Γ are one combined, ordered context.
  private buildKindGammaRegistry(node: KindProofTree, parentGamma: Record<string, ContextValue>): void {
    const combined: Record<string, ContextValue> = {...node.delta, ...node.gamma};
    this.gammaRegistry.register(combined, parentGamma);

    for (const premise of node.premises) {
      this.buildKindGammaRegistry(premise, combined);
    }
  }

  private registerConstraints(node: InferProofTree): SetRegistration | null {
    if (node.constraints.length === 0) {
      return null;
    }

    const existing = this.constraintsByRef.get(node.constraints);
    if (existing) {
      return existing;
    }

    const covered = new Set<Constraint>();
    const parts: string[] = [];

    for (const premise of node.premises) {
      if (!CT_RULES.has(premise.rule)) {
        continue;
      }

      const premiseConstraints = (premise as InferProofTree).constraints;
      premiseConstraints.forEach((c) => covered.add(c));

      if (premiseConstraints.length === 0) {
        parts.push("\\emptyset");
      } else {
        const reg = this.constraintsByRef.get(premiseConstraints);
        parts.push(reg ? reg.shortTex : LetPolymorphismTexMapper.constraintSetLiteral(premiseConstraints));
      }
    }

    const newOnes = node.constraints.filter((c) => !covered.has(c));
    if (newOnes.length > 0) {
      parts.push(LetPolymorphismTexMapper.constraintSetLiteral(newOnes));
    }

    const index = this.constraintsByRef.size + 1;
    const key = `C${index}`;
    const shortTex = `C_{${index}}`;
    const recipe = parts.length > 0 ? parts.join(" \\cup ") : "\\emptyset";

    const registration: SetRegistration = {key, shortTex, fullTex: `${shortTex} = ${recipe}`};
    this.constraintsByRef.set(node.constraints, registration);
    this.registry[key] = {shortTex: registration.shortTex, fullTex: registration.fullTex};
    return registration;
  }

  private static constraintSetLiteral(constraints: Constraint[]): string {
    return `\\{ ${constraints.map((c) => `${TexMapper.typeToTex(c.left)} = ${TexMapper.typeToTex(c.right)}`).join(", ")} \\}`;
  }

  private gammaRefFor(node: InferProofTree): SetRegistration | null {
    return this.gammaRegistry.refFor(node.gamma);
  }

  private constraintsRefFor(node: InferProofTree): SetRegistration | null {
    if (node.constraints.length === 0) {
      return null;
    }
    return this.constraintsByRef.get(node.constraints) ?? null;
  }

  // ===== dispatch ==========================================================

  private dispatch(node: InferProofTree): TexTree {
    switch (node.rule) {
      case Rule.CtVar:
      case Rule.CtVarLet:
        return this.visitVar(node);
      case Rule.CtAbs:
      case Rule.CtAbsInf:
      case Rule.CtDummyAbs:
        return this.visitAbs(node);
      case Rule.CtApp:
        return this.visitApp(node);
      case Rule.CtLit:
        return this.visitLit(node);
      case Rule.CtIf:
        return this.visitIfCondition(node);
      case Rule.CtInl:
        return this.visitInlInr(node, "CT-Inl");
      case Rule.CtInr:
        return this.visitInlInr(node, "CT-Inr");
      case Rule.CtCase:
        return this.visitChildren(node, "CT-Case");
      case Rule.CtVariantCase:
        return this.visitChildren(node, "CT-VariantCase");
      case Rule.CtVariant:
        return this.visitChildren(node, "CT-Variant");
      case Rule.CtAscribe:
        return this.visitChildren(node, "CT-Ascribe");
      case Rule.CtTuple:
        return this.visitChildren(node, "CT-Tuple");
      case Rule.CtTupleProjection:
        return this.visitChildren(node, "CT-Proj");
      case Rule.CtRecord:
        return this.visitChildren(node, "CT-Record");
      case Rule.CtRecordProjection:
        return this.visitChildren(node, "CT-RecordProj");
      case Rule.CtSequencing:
        return this.visitChildren(node, "CT-Seq");
      case Rule.CtLet:
        return this.visitLet(node);
      case Rule.CtBinOp:
        return this.visitBinOp(node);
      case Rule.CtFix:
        return this.visitChildren(node, "CT-Fix");
      case Rule.CtNil:
        return this.visitChildren(node, "CT-Nil");
      case Rule.CtCons:
        return this.visitChildren(node, "CT-Cons");
      case Rule.CtIsNil:
        return this.visitChildren(node, "CT-IsNil");
      case Rule.CtHead:
        return this.visitChildren(node, "CT-Head");
      case Rule.CtTail:
        return this.visitChildren(node, "CT-Tail");
      case Rule.CtFold:
        return this.visitChildren(node, "CT-Fold");
      case Rule.CtUnfold:
        return this.visitChildren(node, "CT-Unfold");
      default:
        throw new Error("Unknown constraint-typing rule: " + node.rule);
    }
  }

  private visitVar(node: InferProofTree): TexTree {
    const ruleLabel = node.rule === Rule.CtVarLet ? "CT-VarLet" : "CT-Var";

    if (node.premises.length > 0) {
      return {
        ...this.judgements(node),
        rule: "CT-Def",
        meta: (node.term as any).name as string,
        children: node.premises.map((child) => this.visit(child)),
        // Collapsed, looks like a plain CT-Var/CT-VarLet lookup — expanding reveals the proof.
        collapsedRule: ruleLabel,
        collapsedChildren: [this.variableMembershipTex(node)],
      };
    }

    return {
      ...this.judgements(node),
      rule: ruleLabel,
      children: [this.variableMembershipTex(node)],
    };
  }

  private visitAbs(node: InferProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "CT-Abs",
      children: this.childrenWithKind(node),
    };
  }

  private visitApp(node: InferProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "CT-App",
      children: node.premises.map((child) => this.visit(child)),
    };
  }

  private visitLit(node: InferProofTree): TexTree {
    const value = (node.term as any).value as string;
    const rule = (value === "unit" || value === "Unit") ? "CT-Unit"
      : (value === "true" || value === "True") ? "CT-True"
      : (value === "false" || value === "False") ? "CT-False"
      : (value.startsWith('"') && value.endsWith('"')) ? "CT-String"
      : "CT-Nv";

    return {
      ...this.judgements(node),
      rule,
      children: [],
    };
  }

  private visitIfCondition(node: InferProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "CT-If",
      children: node.premises.map((child) => this.visit(child)),
    };
  }

  private visitInlInr(node: InferProofTree, rule: string): TexTree {
    return {
      ...this.judgements(node),
      rule,
      children: this.childrenWithKind(node),
    };
  }

  private visitChildren(node: InferProofTree, rule: string): TexTree {
    return {
      ...this.judgements(node),
      rule,
      children: this.childrenWithKind(node),
    };
  }

  // Mirrors TexMapper.childrenWithKind — a no-op for rules that never set kindPremise/typeConversion.
  private childrenWithKind(node: InferProofTree): TexTree[] {
    const children = node.premises.map((child) => this.visit(child));
    if (node.kindPremise) children.push(TexMapper.kindProofTex(node.kindPremise, this.gammaRegistry));
    if (node.typeConversion) children.push(TexMapper.conversionTex(node.typeConversion));
    return children;
  }

  private visitBinOp(node: InferProofTree): TexTree {
    const operator = (node.term as any).operator;
    return this.visitChildren(node, `CT-${TexMapper.binOpRuleName(operator)}`);
  }

  private visitLet(node: InferProofTree): TexTree {
    const [valueProof, bodyProof] = node.premises;
    const letName = (node.term as any).name as string;

    // The value may have failed to type-check — that error path has no body to generalize into.
    if (!bodyProof) {
      return {
        ...this.judgements(node),
        rule: "CT-Let",
        children: [this.visit(valueProof)],
      };
    }

    return {
      ...this.judgements(node),
      rule: "CT-Let",
      children: [
        this.visit(valueProof),
        this.generalizeTex(valueProof, bodyProof, letName),
        this.visit(bodyProof),
      ],
    };
  }

  // Shows the generalize(T, Γ) = S step, the dual of instantiate(...) shown at each CT-VarLet site.
  private generalizeTex(valueProof: ProofTree, bodyProof: ProofTree, letName: string): TexTree {
    const scheme = bodyProof.gamma[letName];
    const schemeTex = scheme !== undefined ? TexMapper.typeToTex(scheme) : TexMapper.typeToTex(valueProof.type);
    const gammaRef = CT_RULES.has(valueProof.rule) ? this.gammaRefFor(valueProof as InferProofTree) : null;
    const gammaTex = gammaRef ? gammaRef.shortTex : "\\Gamma";

    return {
      judgement: `\\mathit{generalize}(${TexMapper.typeToTex(valueProof.type)}, ${gammaTex}) = ${schemeTex}`,
      rule: "",
    };
  }

  private variableMembershipTex(node: InferProofTree): TexTree {
    const variableName = (node.term as any).name;
    const gammaRef = this.gammaRefFor(node);
    const gammaTex = gammaRef ? gammaRef.shortTex : "\\Gamma";
    const gammaSeg: TexSegment = gammaRef
      ? {kind: "ref", key: gammaRef.key}
      : {kind: "tex", value: "\\Gamma"};
    const registry = {...this.registry, ...this.typeAliasRegistry.registry};

    // CT-VarLet looks up a TypeScheme and instantiates it — show the scheme
    // that was found (∀X.T when generalized) rather than a plain membership
    // fact, matching the lecture's "instantiate(x : scheme ∈ Γ)" notation.
    if (node.rule === Rule.CtVarLet) {
      const scheme = node.gamma[variableName];
      const schemeTex = scheme !== undefined ? TexMapper.typeToTex(scheme) : TexMapper.typeToTex(node.type);
      // Only a monomorphic (unquantified) scheme can fold to a typedef —
      // ∀X.T doesn't correspond to a single aliasable Type.
      const aliasRef = scheme !== undefined && scheme.kind === "TypeScheme" && scheme.vars.length === 0
        ? this.typeAliasRegistry.refFor(scheme.type)
        : scheme === undefined
          ? this.typeAliasRegistry.refFor(node.type)
          : null;
      const schemeSeg: TexSegment = aliasRef ? {kind: "ref", key: aliasRef.key} : {kind: "tex", value: schemeTex};

      return {
        id: `${node.id}-membership`,
        judgement: `\\mathit{instantiate}(${variableName} : ${schemeTex} \\in ${gammaTex})`,
        judgementSegments: [
          {kind: "tex", value: `\\mathit{instantiate}(${variableName} : `},
          schemeSeg,
          {kind: "tex", value: " \\in "},
          gammaSeg,
          {kind: "tex", value: ")"},
        ],
        registry,
        rule: "",
        contextTooltip: gammaRef?.shadowTooltip,
      };
    }

    const aliasRef = this.typeAliasRegistry.refFor(node.type);
    const typeSeg: TexSegment = aliasRef
      ? {kind: "ref", key: aliasRef.key}
      : {kind: "tex", value: TexMapper.typeToTex(node.type)};

    return {
      id: `${node.id}-membership`,
      judgement: `${variableName} : ${TexMapper.typeToTex(node.type)} \\in ${gammaTex}`,
      judgementSegments: [
        {kind: "tex", value: `${variableName} : `},
        typeSeg,
        {kind: "tex", value: " \\in "},
        gammaSeg,
      ],
      registry,
      rule: "",
      contextTooltip: gammaRef?.shadowTooltip,
    };
  }

  // ===== judgement construction ============================================

  private judgements(node: InferProofTree): Pick<TexTree, "judgement" | "judgementSegments" | "registry" | "contextTooltip"> {
    const gammaRef = this.gammaRefFor(node);
    const constraintsRef = this.constraintsRefFor(node);
    const term = TexMapper.termToTex(node.term);
    const type = TexMapper.typeToTex(node.type);
    const aliasRef = this.typeAliasRegistry.refFor(node.type);

    const gammaSeg: TexSegment = gammaRef
      ? {kind: "ref", key: gammaRef.key}
      : {kind: "tex", value: "\\emptyset"};
    const typeSeg: TexSegment = aliasRef
      ? {kind: "ref", key: aliasRef.key}
      : {kind: "tex", value: type};
    const constraintsSeg: TexSegment = constraintsRef
      ? {kind: "ref", key: constraintsRef.key}
      : {kind: "tex", value: "\\emptyset"};

    const judgementSegments: TexSegment[] = [
      gammaSeg,
      {kind: "tex", value: " \\vdash "},
      ...TexMapper.termToTexSegments(node.term, this.typeAliasRegistry),
      {kind: "tex", value: " : "},
      typeSeg,
      {kind: "tex", value: " \\mid "},
      constraintsSeg,
    ];

    const gammaTex = gammaRef ? gammaRef.shortTex : "\\emptyset";
    const constraintsTex = constraintsRef ? constraintsRef.shortTex : "\\emptyset";

    return {
      judgement: `${gammaTex} \\vdash ${term} : ${type} \\mid ${constraintsTex}`,
      judgementSegments,
      registry: this.registry,
      contextTooltip: gammaRef?.shadowTooltip,
    };
  }
}
