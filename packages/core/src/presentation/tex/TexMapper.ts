import {ProofTreeVisitor} from "@/application/ProofTreeVisitor.ts";
import type {TexSegment, TexTree} from "@/presentation/tex/texTree.ts";
import {type KindProofTree, type ProofTree, Rule, type TypeConversion, type TypeScheme} from "@/application/typecheck/ProofTree.ts";
import {isKind} from "@/domain/ast";
import type {BinaryOperator, Kind, Term, Type} from "@/domain/ast";
import {CT_RULES, LetPolymorphismTexMapper} from "@/presentation/tex/LetPolymorphismTexMapper.ts";
import {GammaRegistry, type ContextValue} from "@/presentation/tex/GammaRegistry.ts";
import {TypeAliasRegistry} from "@/presentation/tex/TypeAliasRegistry.ts";

const BINOP_TEX_SYMBOLS: Record<BinaryOperator, string> = {
  "+": "+",
  "-": "-",
  "*": "\\times",
  "/": "/",
  "<": "<",
  ">": ">",
  "<=": "\\leq",
  ">=": "\\geq",
  "==": "=",
  "!=": "\\neq",
};

// Suffix only — callers prefix "T-" or "CT-", so one BinOp visitor method displays a distinct rule per operator.
const BINOP_RULE_NAMES: Record<BinaryOperator, string> = {
  "+": "Plus",
  "-": "Minus",
  "*": "Times",
  "/": "Div",
  "<": "Lt",
  ">": "Gt",
  "<=": "Leq",
  ">=": "Geq",
  "==": "Eq",
  "!=": "Neq",
};

export class TexMapper extends ProofTreeVisitor<TexTree> {

  private readonly gammaRegistry: GammaRegistry;
  private registryBuilt = false;
  private typeAliasRegistry: TypeAliasRegistry;

  // gammaRegistry is shared with LetPolymorphismTexMapper so Γ_n numbering stays continuous across a `let` boundary.
  constructor(typeAliasRegistry: TypeAliasRegistry = new TypeAliasRegistry({}), gammaRegistry: GammaRegistry = new GammaRegistry()) {
    super();
    this.typeAliasRegistry = typeAliasRegistry;
    this.gammaRegistry = gammaRegistry;
  }

  // Called once before each top-level visit(), since this mapper is a long-lived singleton;
  // also resets the Γ registry so a previous render's registrations don't leak into this one.
  setTypeAliases(aliases: { [name: string]: Type }): void {
    this.typeAliasRegistry = new TypeAliasRegistry(aliases);
    this.gammaRegistry.reset();
    this.registryBuilt = false;
  }

  visit(node: ProofTree): TexTree {
    // A constraint-typing (CT-*) proof tree belongs to LetPolymorphismTexMapper.
    if (CT_RULES.has(node.rule)) {
      return new LetPolymorphismTexMapper(this.typeAliasRegistry, this.gammaRegistry).visit(node);
    }

    if (!this.registryBuilt) {
      this.buildGammaRegistry(node, null);
      this.registryBuilt = true;
    }

    const tex = super.visit(node)
    if (node.error)
      tex.error = node.error;
    tex.id = node.id;
    tex.pos = node.term.pos;
    return tex;
  }

  // Walks the whole derivation, plain and CT-rule nodes alike, so numbering stays consistent across a `let` boundary.
  private buildGammaRegistry(node: ProofTree, parent: ProofTree | null): void {
    this.gammaRegistry.register(node.gamma, parent?.gamma ?? null);

    if (node.kindPremise) {
      this.buildKindGammaRegistry(node.kindPremise, node.gamma);
    }

    for (const premise of node.premises) {
      this.buildGammaRegistry(premise, node);
    }
  }

  // Δ (type variables) and Γ (term variables) are just one combined, ordered context — a
  // KindProofTree node's Δ growing relative to its parent (entering a λX:K abstraction's body)
  // registers exactly like a term node's Γ growing, producing the same "Γ_n = Γ_m ∪ {X : K}" recipe.
  private buildKindGammaRegistry(node: KindProofTree, parentGamma: Record<string, ContextValue>): void {
    const combined: Record<string, ContextValue> = {...node.delta, ...node.gamma};
    this.gammaRegistry.register(combined, parentGamma);

    for (const premise of node.premises) {
      this.buildKindGammaRegistry(premise, combined);
    }
  }

  // node.premises as TexTree children, plus the node's kind derivation/type conversion if present.
  private childrenWithKind(node: ProofTree): TexTree[] {
    const children = node.premises.map((child) => this.visit(child));
    if (node.kindPremise) children.push(TexMapper.kindProofTex(node.kindPremise, this.gammaRegistry));
    if (node.typeConversion) children.push(TexMapper.conversionTex(node.typeConversion));
    return children;
  }

  private static readonly KIND_RULE_LABELS: Partial<Record<Rule, string>> = {
    [Rule.KindBase]: "K-Base",
    [Rule.KindVar]: "K-Var",
    [Rule.KindForm]: "K-Form",
    [Rule.KindForall]: "K-Forall",
    [Rule.KindAbs]: "K-Abs",
    [Rule.KindApp]: "K-App",
    [Rule.KindPi]: "K-Pi",
    [Rule.KindIndexApp]: "K-IndexApp",
    [Rule.KindMu]: "K-Mu",
  };

  // Renders a kinding derivation (Δ, Γ ⊢ T : K) into the same TexTree shape used for term judgements.
  // Δ and Γ are one combined, ordered context (type variables before term variables, per the lecture's
  // unified-context PTS presentation) — registered together by buildKindGammaRegistry, so it's a single
  // Γ_n reference here, exactly like every other Γ in the tree (including the "Γ_n = Γ_m ∪ {X : K}"
  // recipe when Δ grows entering a λX:K abstraction's body). A single ":" throughout, not "::", since
  // the lecture uses one relation across all levels.
  static kindProofTex(node: KindProofTree, gammaRegistry: GammaRegistry): TexTree {
    const combined: Record<string, ContextValue> = {...node.delta, ...node.gamma};
    const ref = gammaRegistry.refFor(combined);

    const contextSeg: TexSegment = ref ? {kind: "ref", key: ref.key} : {kind: "tex", value: "\\emptyset"};
    const contextTex = ref ? ref.shortTex : "\\emptyset";

    const children = node.premises.map((p) => this.kindProofTex(p, gammaRegistry));
    if (node.indexPremise) {
      children.push(this.indexPremiseTex(node.indexPremise, contextSeg, contextTex, gammaRegistry));
    }

    return {
      judgement: `${contextTex} \\vdash\\, ${this.typeToTex(node.subject)} : ${kindToTex(node.resultKind)}`,
      judgementSegments: [
        contextSeg,
        {kind: "tex", value: ` \\vdash\\, ${this.typeToTex(node.subject)} : ${kindToTex(node.resultKind)}`},
      ],
      registry: gammaRegistry.registry,
      rule: this.KIND_RULE_LABELS[node.rule] ?? node.rule,
      id: node.id,
      children,
    };
  }

  // K-IndexApp's Γ ⊢ t : A premise — the index is always a Var or a literal, so this is a leaf.
  private static indexPremiseTex(node: ProofTree, contextSeg: TexSegment, contextTex: string, gammaRegistry: GammaRegistry): TexTree {
    const term = this.termToTex(node.term);
    const type = this.typeToTex(node.type);
    const rule = node.term.kind === "Var" ? "T-Var" : this.litRuleLabel(String((node.term as {value: unknown}).value));
    return {
      judgement: `${contextTex} \\vdash ${term} : ${type}`,
      judgementSegments: [contextSeg, {kind: "tex", value: ` \\vdash ${term} : ${type}`}],
      registry: gammaRegistry.registry,
      rule,
      id: node.id,
      children: [],
    };
  }

  private static litRuleLabel(value: string): string {
    if (value === "unit" || value === "Unit") return "T-Unit";
    if (value === "true" || value === "True" || value === "false" || value === "False") return "T-Bool";
    if (value.startsWith('"') && value.endsWith('"')) return "T-String";
    return "T-Nat";
  }

  // The (Conv) rule made visible as a leaf fact — nothing further to expand.
  static conversionTex(conversion: TypeConversion): TexTree {
    return {
      judgement: `${this.typeToTex(conversion.before)} \\equiv_\\beta ${this.typeToTex(conversion.after)}`,
      rule: "Conv",
      ruleTooltip: "Type-level β-reduction (the Conv rule): the annotation as written and its normal form are the same type, just different ASTs before/after unfolding type constructors. Applied once here rather than kept as a separate step during unification.",
    };
  }

  protected visitAbs(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Abs",
      children: this.childrenWithKind(node)
    }
  }

  protected visitApp(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: node.rule === Rule.TPiApp ? "T-PiApp" : "T-App",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitVar(node: ProofTree): TexTree {
    if (node.premises.length > 0) {
      return {
        ...this.judgements(node),
        rule: "T-Def",
        meta: (node.term as any).name as string,
        children: node.premises.map(child => this.visit(child)),
        // Collapsed, looks like a plain variable lookup — expanding reveals the T-Def proof.
        collapsedRule: "T-Var",
        collapsedChildren: [this.variableMembershipTex(node)],
      }
    }
    return {
      ...this.judgements(node),
      rule: "T-Var",
      children: [this.variableMembershipTex(node)]
    }
  }

  protected visitLit(node: ProofTree): TexTree {
    const value = (node.term as any).value as string
    return {
      ...this.judgements(node),
      rule: TexMapper.litRuleLabel(value),
      children: []
    }
  }

  protected visitIfCondition(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-If",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitInl(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Inl",
      children: this.childrenWithKind(node)
    }
  }

  protected visitInr(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Inr",
      children: this.childrenWithKind(node)
    }
  }

  protected visitCase(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Case",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitVariantCase(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-VariantCase",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitVariant(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Variant",
      children: this.childrenWithKind(node)
    }
  }

  protected visitAscribe(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Ascribe",
      children: this.childrenWithKind(node)
    }
  }

  protected visitTuple(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Tuple",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitTupleProjection(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Proj",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitRecord(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Record",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitRecordProjection(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-RecordProj",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitSequencing(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Seq",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitDummyAbstraction(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Wildcard",
      ruleTooltip: "Like T-Abs, but a wildcard parameter (λ_:T. t) is never bound — the body is checked in the unchanged Γ.",
      children: this.childrenWithKind(node)
    }
  }

  protected visitBinOp(node: ProofTree): TexTree {
    const operator = (node.term as any).operator as BinaryOperator;
    return {
      ...this.judgements(node),
      rule: `T-${BINOP_RULE_NAMES[operator]}`,
      children: node.premises.map(child => this.visit(child))
    }
  }

  static binOpRuleName(operator: BinaryOperator): string {
    return BINOP_RULE_NAMES[operator];
  }

  protected visitFix(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Fix",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitNil(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Nil",
      children: this.childrenWithKind(node)
    }
  }

  protected visitCons(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Cons",
      children: this.childrenWithKind(node)
    }
  }

  protected visitIsNil(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-IsNil",
      children: this.childrenWithKind(node)
    }
  }

  protected visitHead(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Head",
      children: this.childrenWithKind(node)
    }
  }

  protected visitTail(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Tail",
      children: this.childrenWithKind(node)
    }
  }

  protected visitFold(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Fold",
      children: this.childrenWithKind(node)
    }
  }

  protected visitUnfold(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Unfold",
      children: this.childrenWithKind(node)
    }
  }

  // Only reached when Let-polymorphism is disabled (checker rejects the term instead of using CtLet).
  protected visitLet(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-Let",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitTypeAbstraction(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-TAbs",
      children: node.premises.map(child => this.visit(child))
    }
  }

  protected visitTypeApplication(node: ProofTree): TexTree {
    return {
      ...this.judgements(node),
      rule: "T-TApp",
      children: this.childrenWithKind(node)
    }
  }

  private variableMembershipTex(node: ProofTree): TexTree {
    const variableName = (node.term as any).name
    const variableType = TexMapper.typeToTex(node.type)
    const gammaRef = this.gammaRegistry.refFor(node.gamma)
    const gammaTex = gammaRef ? gammaRef.shortTex : "\\Gamma"
    const aliasRef = this.typeAliasRegistry.refFor(node.type)

    const gammaSeg: TexSegment = gammaRef
      ? {kind: "ref", key: gammaRef.key}
      : {kind: "tex", value: "\\Gamma"}
    const typeSeg: TexSegment = aliasRef
      ? {kind: "ref", key: aliasRef.key}
      : {kind: "tex", value: variableType}

    return {
      id: `${node.id}-membership`,
      judgement: `${variableName} : ${variableType} \\in ${gammaTex}`,
      judgementSegments: [
        {kind: "tex", value: `${variableName} : `},
        typeSeg,
        {kind: "tex", value: " \\in "},
        gammaSeg,
      ],
      registry: {...this.gammaRegistry.registry, ...this.typeAliasRegistry.registry},
      rule: "",
      contextTooltip: gammaRef?.shadowTooltip,
    }
  }

  private judgements(node: ProofTree): Pick<TexTree, "judgement" | "judgementSegments" | "registry" | "contextTooltip"> {
    const gammaRef = this.gammaRegistry.refFor(node.gamma)
    const term = TexMapper.termToTex(node.term)
    const type = TexMapper.typeToTex(node.type)
    const aliasRef = this.typeAliasRegistry.refFor(node.type)

    const gammaSeg: TexSegment = gammaRef
      ? {kind: "ref", key: gammaRef.key}
      : {kind: "tex", value: "\\emptyset"}

    const typeSeg: TexSegment = aliasRef
      ? {kind: "ref", key: aliasRef.key}
      : {kind: "tex", value: type}

    const judgementSegments: TexSegment[] = [
      gammaSeg,
      {kind: "tex", value: " \\vdash "},
      ...TexMapper.termToTexSegments(node.term, this.typeAliasRegistry),
      {kind: "tex", value: " : "},
      typeSeg,
    ]

    const gammaTex = gammaRef ? gammaRef.shortTex : "\\emptyset"

    return {
      judgement: `${gammaTex} \\vdash ${term} : ${type}`,
      judgementSegments,
      registry: {...this.gammaRegistry.registry, ...this.typeAliasRegistry.registry},
      contextTooltip: gammaRef?.shadowTooltip,
    }
  }

  // Segment-producing counterpart to termToTex — used for interactive rendering, so a type
  // embedded inside the term (a λ's annotation, an ascription, ...) gets its own clickable ref segment.
  static termToTexSegments(term: Term, aliasRegistry: TypeAliasRegistry): TexSegment[] {
    const t = (value: string): TexSegment => ({kind: "tex", value});
    const ty = (type: Type): TexSegment[] => this.typeToTexSegments(type, aliasRegistry);
    const rec = (sub: Term): TexSegment[] => this.termToTexSegments(sub, aliasRegistry);

    switch (term.kind) {
      case "Var":
        return [t(term.name)];
      case "Lit":
        return [t(term.value.toString())];
      case "Abs":
        return term.paramType
          ? [t(`(\\lambda ${term.param} : `), ...ty(term.paramType), t(" . "), ...rec(term.body), t(")")]
          : [t(`(\\lambda ${term.param} . `), ...rec(term.body), t(")")];
      case "App":
        return [t("("), ...rec(term.func), t("\\ "), ...rec(term.arg), t(")")];
      case "Inl":
        return [t("\\text{inl}\\ "), ...rec(term.term), t("\\ \\text{as}\\ "), ...ty(term.type)];
      case "Inr":
        return [t("\\text{inr}\\ "), ...rec(term.term), t("\\ \\text{as}\\ "), ...ty(term.type)];
      case "IfCondition": {
        const segs: TexSegment[] = [
          t("\\text{if}\\ "), ...rec(term.condition), t("\\ \\text{then}\\ "), ...rec(term.then),
        ];
        for (const branch of term.elif ?? []) {
          segs.push(t("\\ \\text{elseif}\\ "), ...rec(branch.condition), t("\\ \\text{then}\\ "), ...rec(branch.then));
        }
        if (term.else) {
          segs.push(t("\\ \\text{else}\\ "), ...rec(term.else));
        }
        return segs;
      }
      case "Case":
        return [
          t("\\text{case}\\ "), ...rec(term.variable),
          t(`\\ \\text{of}\\ \\text{inl}\\ ${term.inl.variable} \\Rightarrow `), ...rec(term.inl.term),
          t(`\\ |\\ \\text{inr}\\ ${term.inr.variable} \\Rightarrow `), ...rec(term.inr.term),
        ];
      case "VariantCase": {
        const segs: TexSegment[] = [t("\\text{case}\\ "), ...rec(term.variable), t("\\ \\text{of}\\ ")];
        term.cases.forEach((c, i) => {
          if (i > 0) segs.push(t("\\ |\\ "));
          segs.push(t(`[${c.label}=${c.variable}] \\Rightarrow `), ...rec(c.body));
        });
        return segs;
      }
      case "Variant": {
        const segs: TexSegment[] = [t("[")];
        term.variants.forEach((v, i) => {
          if (i > 0) segs.push(t(", "));
          segs.push(t(`${v.label}=`), ...rec(v.term));
        });
        segs.push(t("]\\ \\text{as}\\ "), ...ty(term.type));
        return segs;
      }
      case "Ascribe":
        return [t("("), ...rec(term.term), t("\\ \\text{as}\\ "), ...ty(term.type), t(")")];
      case "TupleProjection":
        return [...rec(term.tuple), t(`.${term.index}`)];
      case "RecordProjection":
        return [...rec(term.term), t(`.${term.label}`)];
      case "Record": {
        const segs: TexSegment[] = [t("\\langle ")];
        term.fields.forEach((f, i) => {
          if (i > 0) segs.push(t(", "));
          segs.push(t(`${f.label}=`), ...rec(f.term));
        });
        segs.push(t(" \\rangle"));
        return segs;
      }
      case "Sequencing":
        return [...rec(term.first), t("; "), ...rec(term.second)];
      case "Tuple": {
        const segs: TexSegment[] = [t("\\langle ")];
        term.elements.forEach((e, i) => {
          if (i > 0) segs.push(t(", "));
          segs.push(...rec(e));
        });
        segs.push(t(" \\rangle"));
        return segs;
      }
      case "DummyAbstraction":
        return [t("(\\lambda \\_ : "), ...ty(term.paramType), t(" . "), ...rec(term.body), t(")")];
      case "Let":
        return [t(`\\text{let}\\ ${term.name} = `), ...rec(term.value), t("\\ \\text{in}\\ "), ...rec(term.body)];
      case "BinOp":
        return [t("("), ...rec(term.left), t(` ${BINOP_TEX_SYMBOLS[term.operator]} `), ...rec(term.right), t(")")];
      case "Fix":
        return [t("\\mathit{fix}\\ "), ...rec(term.term)];
      case "TypeAbs":
        return [t(`(\\Lambda ${term.typeParam} . `), ...rec(term.body), t(")")];
      case "TypeApp":
        return [...rec(term.term), t("\\ ["), ...ty(term.typeArg), t("]")];
      case "Nil":
        return [t("\\text{nil}["), ...ty(term.type), t("]")];
      case "Cons":
        return [t("\\text{cons}["), ...ty(term.type), t("]\\ "), ...rec(term.head), t("\\ "), ...rec(term.tail)];
      case "IsNil":
        return [t("\\text{isnil}["), ...ty(term.type), t("]\\ "), ...rec(term.term)];
      case "Head":
        return [t("\\text{head}["), ...ty(term.type), t("]\\ "), ...rec(term.term)];
      case "Tail":
        return [t("\\text{tail}["), ...ty(term.type), t("]\\ "), ...rec(term.term)];
      case "Fold":
        return [t("\\text{fold}["), ...ty(term.type), t("]\\ "), ...rec(term.term)];
      case "Unfold":
        return [t("\\text{unfold}["), ...ty(term.type), t("]\\ "), ...rec(term.term)];
    }
  }

  // `wrap`, when given, applies only to the term's own direct children — lets a caller mark
  // individual immediate sub-term spans (e.g. an App's func/arg) as addressable in the TeX string.
  static termToTex(term: Term, wrap?: (subterm: Term, tex: string) => string): string {
    const rec = (sub: Term): string => {
      const tex = this.termToTex(sub);
      return wrap ? wrap(sub, tex) : tex;
    };
    switch (term.kind) {
      case "Var":
        return term.name
      case "Lit":
        return term.value.toString()
      case "Abs":
        return term.paramType
          ? `(\\lambda ${term.param} : ${this.typeToTex(term.paramType)} . ${rec(term.body)})`
          : `(\\lambda ${term.param} . ${rec(term.body)})`
      case "App":
        return `(${rec(term.func)}\\ ${rec(term.arg)})`
      case "Inl":
        return `\\text{inl}\\ ${rec(term.term)}\\ \\text{as}\\ ${this.typeToTex(term.type)}`
      case "Inr":
        return `\\text{inr}\\ ${rec(term.term)}\\ \\text{as}\\ ${this.typeToTex(term.type)}`
      case "IfCondition": {
        let tex = `\\text{if}\\ ${rec(term.condition)}\\ \\text{then}\\ ${rec(term.then)}`
        for (const branch of term.elif ?? []) {
          tex += `\\ \\text{elseif}\\ ${rec(branch.condition)}\\ \\text{then}\\ ${rec(branch.then)}`
        }
        if (term.else) {
          tex += `\\ \\text{else}\\ ${rec(term.else)}`
        }
        return tex
      }
      case "Case":
        return `\\text{case}\\ ${rec(term.variable)}\\ \\text{of}\\ \\text{inl}\\ ${term.inl.variable} \\Rightarrow ${rec(term.inl.term)}\\ |\\ \\text{inr}\\ ${term.inr.variable} \\Rightarrow ${rec(term.inr.term)}`
      case "VariantCase":
        return `\\text{case}\\ ${rec(term.variable)}\\ \\text{of}\\ ${term.cases
          .map((c) => `[${c.label}=${c.variable}] \\Rightarrow ${rec(c.body)}`)
          .join("\\ |\\ ")}`
      case "Variant":
        return `[${term.variants.map((v) => `${v.label}=${rec(v.term)}`).join(", ")}]\\ \\text{as}\\ ${this.typeToTex(term.type)}`
      case "Ascribe":
        return `(${rec(term.term)}\\ \\text{as}\\ ${this.typeToTex(term.type)})`
      case "TupleProjection":
        return `${rec(term.tuple)}.${term.index}`
      case "RecordProjection":
        return `${rec(term.term)}.${term.label}`
      case "Record":
        return `\\langle ${term.fields.map((f) => `${f.label}=${rec(f.term)}`).join(", ")} \\rangle`
      case "Sequencing":
        return `${rec(term.first)}; ${rec(term.second)}`
      case "Tuple":
        return `\\langle ${term.elements.map((e) => rec(e)).join(", ")} \\rangle`
      case "DummyAbstraction":
        return `(\\lambda \\_ : ${this.typeToTex(term.paramType)} . ${rec(term.body)})`
      case "Let":
        return `\\text{let}\\ ${term.name} = ${rec(term.value)}\\ \\text{in}\\ ${rec(term.body)}`
      case "BinOp":
        return `(${rec(term.left)} ${BINOP_TEX_SYMBOLS[term.operator]} ${rec(term.right)})`
      case "Fix":
        return `\\mathit{fix}\\ ${rec(term.term)}`
      case "TypeAbs":
        return `(\\Lambda ${term.typeParam} . ${rec(term.body)})`
      case "TypeApp":
        return `${rec(term.term)}\\ [${this.typeToTex(term.typeArg)}]`
      case "Nil":
        return `\\text{nil}[${this.typeToTex(term.type)}]`
      case "Cons":
        return `\\text{cons}[${this.typeToTex(term.type)}]\\ ${rec(term.head)}\\ ${rec(term.tail)}`
      case "IsNil":
        return `\\text{isnil}[${this.typeToTex(term.type)}]\\ ${rec(term.term)}`
      case "Head":
        return `\\text{head}[${this.typeToTex(term.type)}]\\ ${rec(term.term)}`
      case "Tail":
        return `\\text{tail}[${this.typeToTex(term.type)}]\\ ${rec(term.term)}`
      case "Fold":
        return `\\text{fold}[${this.typeToTex(term.type)}]\\ ${rec(term.term)}`
      case "Unfold":
        return `\\text{unfold}[${this.typeToTex(term.type)}]\\ ${rec(term.term)}`
    }
  }

  static gammaToTex(gamma: Record<string, Type | TypeScheme>): string {
    const entries = Object.entries(gamma);

    if (entries.length === 0) {
      return "\\emptyset";
    }

    const formatted = entries.map(([name, type]) => `${name} : ${this.typeToTex(type)}`);
    return `\\Gamma = \\{ ${formatted.join(", ")} \\}`;
  }

  static typeToTex(type: Type | TypeScheme): string {
    if (type.kind === "TypeScheme") {
      const body = this.typeToTex(type.type)
      return type.vars.length > 0
        ? `\\forall ${type.vars.map((v) => `\\text{${v}}`).join(", ")}.\\, ${body}`
        : body
    }

    switch (type.kind) {
      case "TyIdentifier":
        return type.name
      case "TyMetaVar":
        return `\\text{${type.name}}`
      case "TyArrow": {
        // Parenthesize sub-arrow on the left (non-default grouping);
        // also parenthesize on the right so right-assoc default is explicit.
        const from = type.from.kind === "TyArrow"
          ? `(${this.typeToTex(type.from)})`
          : this.typeToTex(type.from)
        const to = type.to.kind === "TyArrow"
          ? `(${this.typeToTex(type.to)})`
          : this.typeToTex(type.to)
        return `${from} \\to ${to}`
      }
      case "TupleType":
        return `\\langle ${type.elements.map((e) => this.typeToTex(e)).join(" \\times ")} \\rangle`
      case "SumType":
        return `(${this.typeToTex(type.left)} + ${this.typeToTex(type.right)})`
      case "VariantType":
        return `\\langle ${type.variants.map((v) => `${v.label}:${this.typeToTex(v.type)}`).join(", ")} \\rangle`
      case "RecordType":
        return `\\{ ${type.fields.map((f) => `${f.label}:${this.typeToTex(f.type)}`).join(", ")} \\}`
      case "TyForall":
        return `\\forall ${type.typeVariable}.\\, ${this.typeToTex(type.type)}`
      case "TyConstructorAbs":
        return `\\lambda ${type.typeParam} : ${kindToTex(type.paramKind)} .\\, ${this.typeToTex(type.body)}`
      case "TyConstructorApp":
        return `${this.typeToTex(type.func)}\\ ${this.typeToTex(type.arg)}`
      case "TyPi":
        return `\\Pi ${type.paramVar} : ${this.typeToTex(type.paramType)} .\\, ${this.typeToTex(type.body)}`
      case "TyIndexApp":
        return `${this.typeToTex(type.func)}[${this.termToTex(type.arg)}]`
      case "ListType":
        return `\\text{List}\\ ${this.typeToTex(type.elementType)}`
      case "RecursiveType":
        return `\\mu ${type.typeVariable}.\\, ${this.typeToTex(type.type)}`
    }
  }

  // Segment-producing counterpart to typeToTex. Checks the alias registry at every position a
  // Type can appear, not just the top, so a nested type-constructor name is independently clickable.
  static typeToTexSegments(type: Type, aliasRegistry: TypeAliasRegistry): TexSegment[] {
    const ref = aliasRegistry.refFor(type);
    if (ref) {
      return [{kind: "ref", key: ref.key}];
    }

    const t = (value: string): TexSegment => ({kind: "tex", value});
    const rec = (sub: Type): TexSegment[] => this.typeToTexSegments(sub, aliasRegistry);

    switch (type.kind) {
      case "TyIdentifier":
        return [t(type.name)];
      case "TyMetaVar":
        return [t(`\\text{${type.name}}`)];
      case "TyArrow": {
        const from = type.from.kind === "TyArrow" ? [t("("), ...rec(type.from), t(")")] : rec(type.from);
        const to = type.to.kind === "TyArrow" ? [t("("), ...rec(type.to), t(")")] : rec(type.to);
        return [...from, t(" \\to "), ...to];
      }
      case "TupleType": {
        const segs: TexSegment[] = [t("\\langle ")];
        type.elements.forEach((e, i) => {
          if (i > 0) segs.push(t(" \\times "));
          segs.push(...rec(e));
        });
        segs.push(t(" \\rangle"));
        return segs;
      }
      case "SumType":
        return [t("("), ...rec(type.left), t(" + "), ...rec(type.right), t(")")];
      case "VariantType": {
        const segs: TexSegment[] = [t("\\langle ")];
        type.variants.forEach((v, i) => {
          if (i > 0) segs.push(t(", "));
          segs.push(t(`${v.label}:`), ...rec(v.type));
        });
        segs.push(t(" \\rangle"));
        return segs;
      }
      case "RecordType": {
        const segs: TexSegment[] = [t("\\{ ")];
        type.fields.forEach((f, i) => {
          if (i > 0) segs.push(t(", "));
          segs.push(t(`${f.label}:`), ...rec(f.type));
        });
        segs.push(t(" \\}"));
        return segs;
      }
      case "TyForall":
        return [t(`\\forall ${type.typeVariable}.\\, `), ...rec(type.type)];
      case "TyConstructorAbs":
        return [t(`\\lambda ${type.typeParam} : ${kindToTex(type.paramKind)} .\\, `), ...rec(type.body)];
      case "TyConstructorApp":
        return [...rec(type.func), t("\\ "), ...rec(type.arg)];
      case "TyPi":
        return [t(`\\Pi ${type.paramVar} : ${this.typeToTex(type.paramType)} .\\, `), ...rec(type.body)];
      case "TyIndexApp":
        return [...rec(type.func), t(`[${this.termToTex(type.arg)}]`)];
      case "ListType":
        return [t("\\text{List}\\ "), ...rec(type.elementType)];
      case "RecursiveType":
        return [t(`\\mu ${type.typeVariable}.\\, `), ...rec(type.type)];
    }
  }
}

export function kindToTex(k: Kind): string {
  switch (k.kind) {
    case "StarKind":
      return "*"
    case "KindArrow":
      return `(${isKind(k.from) ? kindToTex(k.from) : TexMapper.typeToTex(k.from)} \\to ${kindToTex(k.to)})`
  }
}
