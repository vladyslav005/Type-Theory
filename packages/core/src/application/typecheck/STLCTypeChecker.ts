import {AstVisitor} from "@/application/AstVisitor.ts";
import {isKind} from "@/domain/ast";
import type {
  Abs,
  App,
  Ascribe,
  ASTNode,
  BinOp,
  Case,
  Cons,
  DummyAbstraction,
  Fix,
  Fold,
  FunDecl,
  Head,
  IfCondition,
  Inl,
  Inr, IsNil, Kind, Let,
  Lit,
  Nil,
  Program,
  Record,
  RecordProjection, RecordType,
  Sequencing,
  Tail,
  Term,
  Tuple,
  TupleProjection, TupleType,
  TyArrow, TyConstructorAbs, TyConstructorApp, TyForall, TyIdentifier, TyPi,
  Type,
  TypeAbs,
  TypeAliasDecl,
  TypeApp,
  TypeConstructorDecl,
  Unfold,
  Var,
  VarDecl,
  Variant,
  VariantCase,
} from "@/domain/ast";
import {Gamma} from "@/application/typecheck/Gamma.ts";
import {
  containsFreeTermVar,
  containsLambdaPConstruct,
  containsTypeConstructor,
  expandTypeAliases,
  isArithmeticOperator,
  kindEquals,
  kindToString,
  normalizeType,
  substituteTermInType,
  substituteTypeVariable,
  termIndexToString,
  typeEquals,
  typeToString,
} from "@/application/typecheck/utils.ts";
import {
  type Constraint,
  ERROR_TYPE,
  type InferenceStep,
  type InferProofTree,
  type KindProofTree,
  type ProofTree,
  Rule,
  type Substitution,
  type TypeConversion,
  type TypeScheme,
  UNTYPED_TYPE,
} from "@/application/typecheck/ProofTree.ts";
import {TypeInferenceEngine} from "@/application/typecheck/TypeInferenceEngine.ts";
import {TypeCheckError} from "@/application/typecheck/TypeCheckError.ts";
import {DEFAULT_TYPE_THEORY_CONFIG, type TypeTheoryConfig} from "@/domain/typeTheory.ts";

// Whether a variable was bound by an ordinary binder or by `let` — purely for picking the
// matching CT-Var / CT-VarLet proof-tree label; has no effect on the computed type.
type VarOrigin = Rule.CtVar | Rule.CtVarLet;

// Single typechecker for the whole language, written once in constraint-generation/unification
// style so theories compose freely. "Plain STLC" is just this engine with `inferring` false.
export class SLTLCTypeChecker extends AstVisitor<InferProofTree> {

  private schemeContext: Gamma<TypeScheme> = new Gamma<TypeScheme>();
  private varOrigin: Gamma<VarOrigin> = new Gamma<VarOrigin>();
  private errorBuffer: Error[] = [];
  private inferenceSteps: InferenceStep[] = [];
  // One tree per entry in inferenceSteps — the whole-program proof with only the substitution
  // known as of that step applied, so the UI can show metavariables resolving node-by-node
  // instead of only ever seeing the final, fully-solved tree.
  private inferenceProofSnapshots: InferProofTree[] = [];
  // A `let`-bound (or global-declaration) value is solved+substituted locally, eagerly, before
  // check()'s own top-level solve even starts — so by the time `visit(program)` returns, that
  // subtree is already fully resolved and its own metavariables are gone from `.type` everywhere.
  // Keyed by that value proof's id, so check() can splice the truly-unresolved version back in
  // before replaying inferenceSteps against it — otherwise a let-local step would have nothing
  // left to visibly resolve.
  private rawValueProofs: Map<string, InferProofTree> = new Map();
  private globalProofs: Map<string, ProofTree> = new Map();
  private theories: TypeTheoryConfig = DEFAULT_TYPE_THEORY_CONFIG;
  private readonly engine: TypeInferenceEngine = new TypeInferenceEngine();

  // name -> fully-expanded underlying type, populated by visitTypeAliasDecl.
  private typeAliases: Map<string, Type> = new Map();

  // name -> declared kind (System λP's opaque "typedef X : K;"), the global counterpart to Δ.
  private kindContext: Map<string, Kind> = new Map();

  // >0 while checking a `let`'s value+body (a counter, since lets can nest).
  private polymorphicScope = 0;

  private get inferring(): boolean {
    return this.polymorphicScope > 0 || this.theories.typeInference;
  }

  private ruleFor(plain: Rule, ct: Rule): Rule {
    return this.inferring ? ct : plain;
  }

  public getErrors(): Error[] {
    return this.errorBuffer;
  }

  public getInferenceSteps(): InferenceStep[] {
    return this.inferenceSteps;
  }

  public getInferenceProofSnapshots(): InferProofTree[] {
    return this.inferenceProofSnapshots;
  }

  // Exposed so the proof-tree renderer can offer "show as alias" for any matching type.
  public getTypeAliases(): { [name: string]: Type } {
    return Object.fromEntries(this.typeAliases);
  }

  // Optional theories beyond core STLC; a construct belonging to a disabled theory is a type error.
  public setTheories(theories: TypeTheoryConfig): void {
    this.theories = theories;
  }

  // Runs inference over the whole program, then solves whatever constraints are still outstanding
  // (a nested `let` already solved+generalized its own value eagerly, via checkLet).
  public check(program: Program): InferProofTree {
    this.schemeContext = new Gamma<TypeScheme>();
    this.varOrigin = new Gamma<VarOrigin>();
    this.errorBuffer = [];
    this.inferenceSteps = [];
    this.inferenceProofSnapshots = [];
    this.rawValueProofs = new Map();
    this.globalProofs = new Map();
    this.typeAliases = new Map();
    this.kindContext = new Map();
    this.polymorphicScope = 0;
    this.engine.reset();

    const proof = this.visit(program);
    let result: InferProofTree;

    try {
      const {substitution, steps} = this.engine.solve(proof.constraints);
      this.inferenceSteps.push(...steps);
      result = this.engine.applySubstitutionToProof(proof, substitution);
    } catch (error) {
      this.inferenceSteps.push(...this.engine.getLastSolveSteps());
      const pos = error instanceof TypeCheckError ? error.pos : undefined;
      const msg = error instanceof Error ? error.message : String(error);
      this.errorBuffer.push(new TypeCheckError(msg, pos));
      result = {...proof, type: ERROR_TYPE, error: msg};
    }

    // `proof` still has any `let`/global value subtree already locally solved (see
    // rawValueProofs) — splice the truly-unresolved versions back in before replaying steps,
    // or a let-local step would have nothing left to visibly resolve.
    const trueRawProof = this.restoreRawValueProofs(proof) as InferProofTree;
    this.inferenceProofSnapshots = this.buildInferenceSnapshots(trueRawProof);
    return result;
  }

  private restoreRawValueProofs(node: ProofTree): ProofTree {
    const raw = (node.id && this.rawValueProofs.get(node.id)) || node;
    return {
      ...raw,
      premises: raw.premises.map((p) => this.restoreRawValueProofs(p)),
    };
  }

  private buildInferenceSnapshots(rawProof: InferProofTree): InferProofTree[] {
    const cumulative: Substitution = new Map();
    // Snapshot 0 is the raw (fully unresolved) tree itself — an explicit "nothing solved yet"
    // starting point, so the UI can show it rather than jumping straight to an already-solved
    // step with no baseline to compare against.
    const snapshots: InferProofTree[] = [rawProof];
    let previous: InferProofTree = rawProof;

    for (const step of this.inferenceSteps) {
      for (const binding of step.newBindings) {
        cumulative.set(binding.name, binding.type);
      }
      const snapshot = this.engine.applySubstitutionToProof(rawProof, cumulative);
      step.affectedNodeIds = this.collectChangedNodeIds(previous, snapshot);
      snapshots.push(snapshot);
      previous = snapshot;
    }

    return snapshots;
  }

  // `previous`/`current` always share the same shape (substitution never changes tree structure),
  // so premises can be walked in lockstep by index.
  private collectChangedNodeIds(previous: ProofTree, current: ProofTree): string[] {
    const ids: string[] = [];

    const walk = (prevNode: ProofTree, curNode: ProofTree) => {
      if (curNode.id && !typeEquals(prevNode.type, curNode.type)) {
        ids.push(curNode.id);
      }
      curNode.premises.forEach((child, i) => walk(prevNode.premises[i], child));
    };

    walk(previous, current);
    return ids;
  }

  visit(node: ASTNode): InferProofTree {
    const proof = super.visit(node);
    proof.id = node.id;

    if ("constraints" in proof) {
      (proof as InferProofTree).constraints = (proof as InferProofTree).constraints.map(
        (c) => c.pos ? c : {...c, pos: node.pos},
      );
    }

    return proof;
  }

  // Extends both the type context and var-origin tracking for the duration of `fn`, then restores both.
  private withBinding<T>(
    name: string,
    scheme: TypeScheme,
    origin: VarOrigin,
    fn: () => T,
  ): T {
    const previousContext = this.schemeContext;
    const previousVarOrigin = this.varOrigin;

    const childContext = previousContext.copy();
    if (childContext.has(name)) {
      childContext.delete(name);
    }
    childContext.add(name, scheme);

    const childVarOrigin = previousVarOrigin.copy();
    if (childVarOrigin.has(name)) {
      childVarOrigin.delete(name);
    }
    childVarOrigin.add(name, origin);

    this.schemeContext = childContext;
    this.varOrigin = childVarOrigin;

    try {
      return fn();
    } finally {
      this.schemeContext = previousContext;
      this.varOrigin = previousVarOrigin;
    }
  }

  // Builds a leaf error proof and records the message — shared by every "not allowed here" gate.
  private reject(term: ASTNode, rule: Rule, msg: string, premises: InferProofTree[] = []): InferProofTree {
    this.errorBuffer.push(new TypeCheckError(msg, term.pos));
    return {
      rule,
      term: term as never,
      type: ERROR_TYPE,
      gamma: this.schemeContext.serializeGamma(),
      premises,
      constraints: premises.flatMap((p) => p.constraints),
      error: msg,
    };
  }

  // Hard-stops a construct that has no meaning in pure untyped lambda calculus (everything
  // except Var/untyped-Abs/App) — called before visiting children, same style as visitLet's
  // own theory gate.
  private rejectIfUntyped(node: ASTNode, rule: Rule, construct: string): InferProofTree | undefined {
    if (!this.theories.untyped) return undefined;
    return this.reject(
      node,
      rule,
      `"${construct}" is not part of untyped lambda calculus — encode it as a pure λ-term (see the lecture's Church encodings), or disable "Untyped lambda calculus" to use it`,
    );
  }

  // Solves + applies a proof's own constraints immediately, rather than deferring to check() —
  // needed where a fully concrete type is required right now (e.g. a global declaration's value).
  private solveLocally(proof: InferProofTree): InferProofTree {
    if (proof.id) this.rawValueProofs.set(proof.id, proof);
    try {
      const {substitution, steps} = this.engine.solve(proof.constraints);
      this.inferenceSteps.push(...steps);
      return this.engine.applySubstitutionToProof(proof, substitution);
    } catch (error) {
      this.inferenceSteps.push(...this.engine.getLastSolveSteps());
      const pos = error instanceof TypeCheckError ? error.pos : undefined;
      const msg = error instanceof Error ? error.message : String(error);
      this.errorBuffer.push(new TypeCheckError(msg, pos));
      return {...proof, type: ERROR_TYPE, error: msg};
    }
  }

  // Called once wherever a Type first enters the checker from surface syntax — everything
  // downstream only ever sees already-expanded types.
  private expandAliases(type: Type, seen: ReadonlySet<string> = new Set()): Type {
    return expandTypeAliases(type, this.typeAliases, seen);
  }

  private literalType(value: string): TyIdentifier {
    const name = (value === "unit" || value === "Unit")
      ? "Unit"
      : (value === "true" || value === "True" || value === "false" || value === "False")
        ? "Bool"
        : (value.startsWith('"') && value.endsWith('"'))
          ? "String"
          : "Nat";

    return {kind: "TyIdentifier", id: crypto.randomUUID(), name};
  }

  // =====================================================================
  // =                        SYSTEM λω̲ — kind-checking                  =
  // =====================================================================

  private static readonly STAR: Kind = {kind: "StarKind", id: "star-sentinel"};

  private kindLeaf(rule: Rule, subject: Type, resultKind: Kind, delta: ReadonlyMap<string, Kind>): KindProofTree {
    return {rule, subject, resultKind, delta: Object.fromEntries(delta), gamma: this.schemeContext.serializeGamma(), premises: [], id: subject.id};
  }

  private kindNode(rule: Rule, subject: Type, resultKind: Kind, delta: ReadonlyMap<string, Kind>, premises: KindProofTree[], indexPremise?: ProofTree): KindProofTree {
    return {rule, subject, resultKind, delta: Object.fromEntries(delta), gamma: this.schemeContext.serializeGamma(), premises, indexPremise, id: subject.id};
  }

  private expectStar(kind: Kind, subject: Type): void {
    if (kind.kind !== "StarKind") {
      throw new Error(`Type "${typeToString(subject)}" has kind ${kindToString(kind)}, but is used where a fully-applied type (kind @) is required — it looks like a type constructor is missing an argument`);
    }
  }

  // Δ ⊢ type :: K — computes the kind of an already-expandAliases'd type, building the derivation
  // as it goes. Every branch that isn't a λω̲ construct just requires * from its immediate parts.
  private kindOf(type: Type, delta: ReadonlyMap<string, Kind>): { kind: Kind; proof: KindProofTree } {
    switch (type.kind) {
      case "TyIdentifier": {
        const bound = delta.get(type.name) ?? this.kindContext.get(type.name);
        if (bound) {
          return {kind: bound, proof: this.kindLeaf(Rule.KindVar, type, bound, delta)};
        }
        // A base type or an unvalidated name — both treated as kind * axiomatically.
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindLeaf(Rule.KindBase, type, SLTLCTypeChecker.STAR, delta)};
      }

      case "TyMetaVar":
        // Internal to unification, never written by the user — always *.
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindLeaf(Rule.KindBase, type, SLTLCTypeChecker.STAR, delta)};

      case "TyArrow": {
        const from = this.kindOf(type.from, delta);
        const to = this.kindOf(type.to, delta);
        this.expectStar(from.kind, type.from);
        this.expectStar(to.kind, type.to);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, [from.proof, to.proof])};
      }

      case "TupleType": {
        const parts = type.elements.map((element) => this.kindOf(element, delta));
        parts.forEach((part, i) => this.expectStar(part.kind, type.elements[i]));
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, parts.map((p) => p.proof))};
      }

      case "SumType": {
        const left = this.kindOf(type.left, delta);
        const right = this.kindOf(type.right, delta);
        this.expectStar(left.kind, type.left);
        this.expectStar(right.kind, type.right);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, [left.proof, right.proof])};
      }

      case "VariantType": {
        const parts = type.variants.map((v) => this.kindOf(v.type, delta));
        parts.forEach((part, i) => this.expectStar(part.kind, type.variants[i].type));
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, parts.map((p) => p.proof))};
      }

      case "RecordType": {
        const parts = type.fields.map((f) => this.kindOf(f.type, delta));
        parts.forEach((part, i) => this.expectStar(part.kind, type.fields[i].type));
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, parts.map((p) => p.proof))};
      }

      case "TyForall": {
        const innerDelta = new Map(delta);
        innerDelta.set(type.typeVariable, SLTLCTypeChecker.STAR);
        const body = this.kindOf(type.type, innerDelta);
        this.expectStar(body.kind, type.type);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForall, type, SLTLCTypeChecker.STAR, delta, [body.proof])};
      }

      case "TyConstructorAbs": {
        const innerDelta = new Map(delta);
        innerDelta.set(type.typeParam, type.paramKind);
        const body = this.kindOf(type.body, innerDelta);
        const resultKind: Kind = {kind: "KindArrow", id: crypto.randomUUID(), from: type.paramKind, to: body.kind};
        return {kind: resultKind, proof: this.kindNode(Rule.KindAbs, type, resultKind, delta, [body.proof])};
      }

      case "TyConstructorApp": {
        const func = this.kindOf(type.func, delta);
        const arg = this.kindOf(type.arg, delta);

        if (func.kind.kind !== "KindArrow") {
          throw new Error(`Cannot apply "${typeToString(type.func)}" (kind ${kindToString(func.kind)}) to an argument — it is not a type constructor`);
        }
        if (!isKind(func.kind.from)) {
          throw new Error(`Type constructor "${typeToString(type.func)}" has a dependent kind (${typeToString(func.kind.from)} -> ${kindToString(func.kind.to)}) and expects a term index, e.g. "${typeToString(type.func)}[...]" — not a type argument`);
        }
        if (!kindEquals(func.kind.from, arg.kind)) {
          throw new Error(`Type constructor "${typeToString(type.func)}" expects an argument of kind ${kindToString(func.kind.from)}, but "${typeToString(type.arg)}" has kind ${kindToString(arg.kind)}`);
        }

        return {kind: func.kind.to, proof: this.kindNode(Rule.KindApp, type, func.kind.to, delta, [func.proof, arg.proof])};
      }

      case "TyPi": {
        const paramKind = this.kindOf(type.paramType, delta);
        this.expectStar(paramKind.kind, type.paramType);
        // paramVar is a term variable, bound into the ambient Γ for the duration of checking the body.
        const body = this.withBinding(
          type.paramVar,
          {kind: "TypeScheme", vars: [], type: type.paramType},
          Rule.CtVar,
          () => this.kindOf(type.body, delta),
        );
        this.expectStar(body.kind, type.body);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindPi, type, SLTLCTypeChecker.STAR, delta, [paramKind.proof, body.proof])};
      }

      case "TyIndexApp": {
        const func = this.kindOf(type.func, delta);
        if (func.kind.kind !== "KindArrow") {
          throw new Error(`Cannot apply "${typeToString(type.func)}" (kind ${kindToString(func.kind)}) to an index — it is not a dependently-kinded type constructor`);
        }
        if (isKind(func.kind.from)) {
          throw new Error(`Type constructor "${typeToString(type.func)}" expects a type argument (kind ${kindToString(func.kind.from)}), not a term index — "${typeToString(type.func)}[...]" is only for a dependent kind like "Nat -> @"`);
        }
        const domainType = func.kind.from;
        const argType = this.indexTermType(type.arg);
        if (!typeEquals(argType, domainType)) {
          throw new Error(`Index "${termIndexToString(type.arg)}" has type ${typeToString(argType)}, but "${typeToString(type.func)}" expects an index of type ${typeToString(domainType)}`);
        }
        const indexPremise: ProofTree = {
          rule: type.arg.kind === "Var" ? Rule.Var : Rule.Lit,
          term: type.arg,
          type: argType,
          gamma: this.schemeContext.serializeGamma(),
          premises: [],
          id: type.arg.id,
        };
        return {kind: func.kind.to, proof: this.kindNode(Rule.KindIndexApp, type, func.kind.to, delta, [func.proof], indexPremise)};
      }

      case "ListType": {
        const element = this.kindOf(type.elementType, delta);
        this.expectStar(element.kind, type.elementType);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindForm, type, SLTLCTypeChecker.STAR, delta, [element.proof])};
      }

      case "RecursiveType": {
        const innerDelta = new Map(delta);
        innerDelta.set(type.typeVariable, SLTLCTypeChecker.STAR);
        const body = this.kindOf(type.type, innerDelta);
        this.expectStar(body.kind, type.type);
        return {kind: SLTLCTypeChecker.STAR, proof: this.kindNode(Rule.KindMu, type, SLTLCTypeChecker.STAR, delta, [body.proof])};
      }
    }
  }

  // System λP restricts a TyIndexApp's term index to a Var (looked up in Γ) or a Lit.
  private indexTermType(term: Term): Type {
    if (term.kind === "Var") {
      const scheme = this.schemeContext.get(term.name);
      if (!scheme) {
        throw new Error(`Variable "${term.name}" is not in scope`);
      }
      return scheme.type;
    }
    if (term.kind === "Lit") {
      return this.literalType(term.value);
    }
    throw new Error(`System λP index expressions are limited to variables and literals — got a "${term.kind}"`);
  }

  // Run after kind-checking but before the type is bound/compared/unified against anything else,
  // so e.g. "Endo Nat" and "Nat -> Nat" are interchangeable despite being different ASTs.
  private normalizeType(type: Type): Type {
    return normalizeType(type);
  }

  // Kind-checks an (already expandAliases'd) type used as a term annotation. A no-op for any type
  // that doesn't mention a λω̲ construct; otherwise gates on the theory flag and requires kind *.
  private checkKindAnnotation(type: Type): { rejected: false; kindPremise?: KindProofTree; conversion?: TypeConversion; normalized: Type } | { rejected: true; message: string } {
    if (this.theories.untyped) {
      return {
        rejected: true,
        message: `Type annotations are not part of untyped lambda calculus — remove the ": T"/"[T]"/"as T", or disable "Untyped lambda calculus" to use types`,
      };
    }

    const usesFOmega = containsTypeConstructor(type);
    const usesLambdaP = containsLambdaPConstruct(type);

    if (!usesFOmega && !usesLambdaP) {
      return {rejected: false, normalized: type};
    }

    if (usesFOmega && !this.theories.systemFOmega) {
      return {
        rejected: true,
        message: `Type "${typeToString(type)}" uses a type constructor (λ-abstraction/application on types) — enable the "System Fω" theory to use it`,
      };
    }

    if (usesLambdaP && !this.theories.systemLambdaP) {
      return {
        rejected: true,
        message: `Type "${typeToString(type)}" uses a dependent type (Π-type or term-indexed type application) — enable the "System λP" theory to use it`,
      };
    }

    try {
      const {kind, proof} = this.kindOf(type, new Map());
      if (kind.kind !== "StarKind") {
        return {
          rejected: true,
          message: `Type "${typeToString(type)}" has kind ${kindToString(kind)}, but a term annotation needs kind @ — it looks like a type constructor is missing an argument`,
        };
      }
      const normalized = this.normalizeType(type);
      // The (Conv) rule's effect made visible — only set when reduction actually did something.
      // Compare the *surface forms*: typeEquals would β-normalize both sides and always match.
      const conversion: TypeConversion | undefined = typeToString(type) === typeToString(normalized)
        ? undefined
        : {before: type, after: normalized};
      return {rejected: false, kindPremise: proof, conversion, normalized};
    } catch (error) {
      return {rejected: true, message: error instanceof Error ? error.message : String(error)};
    }
  }

  protected visitProgram(node: Program): InferProofTree {
    node.globals.forEach((g) => this.visit(g));

    if (!node.term) {
      const msg = "No main expression — write a term after your declarations";
      this.errorBuffer.push(new TypeCheckError(msg, node.pos));
      return {
        rule: Rule.Var,
        term: {kind: "Var", id: node.id, name: "(empty)"} as never,
        type: ERROR_TYPE,
        gamma: this.schemeContext.serializeGamma(),
        premises: [],
        constraints: [],
        error: msg,
      };
    }

    return this.visit(node.term);
  }

  protected visitTermDecl(node: FunDecl): InferProofTree {
    if (!node.type) {
      if (!this.inferring && !this.theories.untyped) {
        const msg = `Declaration "${node.name}" needs a type annotation (${node.name} = value : T;) — omit it only when the Type inference theory or Untyped lambda calculus is enabled`;
        this.errorBuffer.push(new TypeCheckError(msg, node.pos));
        this.schemeContext.add(node.name, {kind: "TypeScheme", vars: [], type: ERROR_TYPE});
        return {} as InferProofTree;
      }

      const valueProof = this.solveLocally(this.visit(node.value));
      this.schemeContext.add(node.name, {kind: "TypeScheme", vars: [], type: valueProof.type});
      this.globalProofs.set(node.name, valueProof);
      return {} as InferProofTree;
    }

    const expanded = this.expandAliases(node.type);
    const kindCheck = this.checkKindAnnotation(expanded);
    if (kindCheck.rejected) {
      this.errorBuffer.push(new TypeCheckError(`Declaration "${node.name}": ${kindCheck.message}`, node.pos));
    }
    const declaredType = kindCheck.rejected ? expanded : kindCheck.normalized;

    const valueProof = this.solveLocally(this.visit(node.value));

    // Add the declared type regardless, so later declarations still type-check.
    this.schemeContext.add(node.name, {kind: "TypeScheme", vars: [], type: declaredType});
    this.globalProofs.set(node.name, valueProof);

    if (!valueProof.error && !typeEquals(valueProof.type, declaredType)) {
      const msg = `Declaration "${node.name}": declared type is ${typeToString(declaredType)}, but the value has type ${typeToString(valueProof.type)}`;
      this.errorBuffer.push(new TypeCheckError(msg, node.pos));
      valueProof.error = msg;
    }

    return {} as InferProofTree;
  }

  protected visitTypeDecl(node: VarDecl): InferProofTree {
    const expanded = this.expandAliases(node.type);
    const kindCheck = this.checkKindAnnotation(expanded);
    if (kindCheck.rejected) {
      this.errorBuffer.push(new TypeCheckError(`Declaration "${node.name}": ${kindCheck.message}`, node.pos));
    }
    const declaredType = kindCheck.rejected ? expanded : kindCheck.normalized;
    this.schemeContext.add(node.name, {kind: "TypeScheme", vars: [], type: declaredType});
    return {} as InferProofTree;
  }

  protected visitTypeAliasDecl(node: TypeAliasDecl): InferProofTree {
    // Expand now, not lazily, so a later typedef built on this one only resolves one level.
    const expanded = this.expandAliases(node.type);
    let normalized = expanded;

    // The RHS may itself be a type constructor, so unlike a term annotation it need not have kind @.
    const usesFOmega = containsTypeConstructor(expanded);
    const usesLambdaP = containsLambdaPConstruct(expanded);
    if (usesFOmega || usesLambdaP) {
      if (usesFOmega && !this.theories.systemFOmega) {
        this.errorBuffer.push(new TypeCheckError(`typedef "${node.name}": uses a type constructor (λ-abstraction/application on types) — enable the "System Fω" theory to use it`, node.pos));
      } else if (usesLambdaP && !this.theories.systemLambdaP) {
        this.errorBuffer.push(new TypeCheckError(`typedef "${node.name}": uses a dependent type (Π-type or term-indexed type application) — enable the "System λP" theory to use it`, node.pos));
      } else {
        try {
          this.kindOf(expanded, new Map());
          // Reduce away any redex in the RHS so every later use starts from its normal form.
          normalized = this.normalizeType(expanded);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.errorBuffer.push(new TypeCheckError(`typedef "${node.name}": ${msg}`, node.pos));
        }
      }
    }

    this.typeAliases.set(node.name, normalized);
    return {} as InferProofTree;
  }

  // typedef X : K; — System λP's opaque type constructor. No RHS to kind-check; just registers X's kind.
  protected visitTypeConstructorDecl(node: TypeConstructorDecl): InferProofTree {
    if (!this.theories.systemLambdaP) {
      this.errorBuffer.push(new TypeCheckError(`typedef "${node.name}": declaring an opaque type constructor requires enabling the "System λP" theory`, node.pos));
      return {} as InferProofTree;
    }
    this.kindContext.set(node.name, node.paramKind);
    return {} as InferProofTree;
  }

  protected visitVar(node: Var): InferProofTree {
    if (this.theories.untyped) {
      if (!this.schemeContext.has(node.name)) {
        const contextKeys = Object.keys(this.schemeContext.serializeGamma());
        const contextHint = contextKeys.length > 0
          ? ` (in-scope variables: ${contextKeys.join(", ")})`
          : " (context is empty)";
        const msg = `Variable "${node.name}" is not in scope${contextHint}`;
        this.errorBuffer.push(new TypeCheckError(msg, node.pos));
        return {rule: Rule.Var, term: node, type: UNTYPED_TYPE, gamma: this.schemeContext.serializeGamma(), premises: [], constraints: [], error: msg};
      }
      return {rule: Rule.Var, term: node, type: UNTYPED_TYPE, gamma: this.schemeContext.serializeGamma(), premises: [], constraints: []};
    }

    const scheme = this.schemeContext.get(node.name);
    const rule = this.inferring ? (this.varOrigin.get(node.name) ?? Rule.CtVar) : Rule.Var;

    if (!scheme) {
      const contextKeys = Object.keys(this.schemeContext.serializeGamma());
      const contextHint = contextKeys.length > 0
        ? ` (in-scope variables: ${contextKeys.join(", ")})`
        : " (context is empty)";
      const msg = `Variable "${node.name}" is not in scope${contextHint}`;
      this.errorBuffer.push(new TypeCheckError(msg, node.pos));

      return {
        rule,
        term: node,
        type: ERROR_TYPE,
        gamma: this.schemeContext.serializeGamma(),
        premises: [],
        constraints: [],
        error: msg,
      };
    }

    const type = this.engine.instantiate(scheme);

    const proof: InferProofTree = {
      rule,
      term: node,
      type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [],
      constraints: [],
    };

    // Only a name that isn't locally shadowed can refer to a global — used for "jump to definition".
    if (!this.varOrigin.has(node.name)) {
      const definitionProof = this.globalProofs.get(node.name);
      if (definitionProof) {
        proof.premises = [definitionProof];
      }
    }

    return proof;
  }

  protected visitAbs(node: Abs): InferProofTree {
    const outerGamma = this.schemeContext.serializeGamma();

    if (this.theories.untyped) {
      if (node.paramType) {
        return this.reject(
          node,
          Rule.Abs,
          `Type annotations are not part of untyped lambda calculus — remove the ":T", or disable "Untyped lambda calculus" to use types`,
        );
      }
      const bodyProof = this.withBinding(
        node.param,
        {kind: "TypeScheme", vars: [], type: UNTYPED_TYPE},
        Rule.CtVar,
        () => this.visit(node.body),
      );
      return {rule: Rule.Abs, term: node, type: UNTYPED_TYPE, gamma: outerGamma, premises: [bodyProof], constraints: []};
    }

    if (!node.paramType && !this.inferring) {
      return this.reject(
        node,
        Rule.Abs,
        `Lambda parameter "${node.param}" needs a type annotation (λ${node.param}:T. ...) — an unannotated parameter is only allowed inside a let-bound value or when the Type inference theory is enabled`,
      );
    }

    // An omitted annotation gets a fresh metavariable, so generalize/unification has something to pin down.
    let paramType = node.paramType ? this.expandAliases(node.paramType) : this.engine.freshTyMetaVar();
    const rule = this.inferring ? (node.paramType ? Rule.CtAbs : Rule.CtAbsInf) : Rule.Abs;

    let kindPremise: KindProofTree | undefined;
    let typeConversion: TypeConversion | undefined;
    if (node.paramType) {
      const kindCheck = this.checkKindAnnotation(paramType);
      if (kindCheck.rejected) {
        return this.reject(node, rule, kindCheck.message);
      }
      kindPremise = kindCheck.kindPremise;
      typeConversion = kindCheck.conversion;
      paramType = kindCheck.normalized;
    }

    const bodyProof = this.withBinding(
      node.param,
      {kind: "TypeScheme", vars: [], type: paramType},
      Rule.CtVar,
      () => this.visit(node.body),
    );

    // System λP: if the body's type mentions this parameter as a term-index, the whole
    // abstraction is dependently typed (e.g. "λn:Nat. λx:Vec[n]. n") — a plain TyArrow can't match.
    const type: TyArrow | TyPi = containsFreeTermVar(bodyProof.type, node.param)
      ? {kind: "TyPi", id: crypto.randomUUID(), paramVar: node.param, paramType, body: bodyProof.type}
      : {kind: "TyArrow", id: crypto.randomUUID(), from: paramType, to: bodyProof.type};

    return {
      rule,
      term: node,
      type,
      gamma: outerGamma,
      premises: [bodyProof],
      constraints: bodyProof.constraints,
      kindPremise,
      typeConversion,
    };
  }

  protected visitApp(node: App): InferProofTree {
    const funcProof = this.visit(node.func);
    const argProof = this.visit(node.arg);

    if (this.theories.untyped) {
      return {rule: Rule.App, term: node, type: UNTYPED_TYPE, gamma: this.schemeContext.serializeGamma(), premises: [funcProof, argProof], constraints: []};
    }

    // System λP: applying a Π-typed function substitutes the argument term itself into the
    // dependent result type — something the generic metavar/unification path can't express.
    const funcType = this.normalizeType(funcProof.type);
    if (funcType.kind === "TyPi") {
      if (!this.theories.systemLambdaP) {
        return this.reject(node, Rule.TPiApp, `Applying a Π-typed function requires enabling the "System λP" theory`, [funcProof, argProof]);
      }
      if (node.arg.kind !== "Var" && node.arg.kind !== "Lit") {
        return this.reject(node, Rule.TPiApp, `Applying a Π-typed function to an argument other than a variable or literal is not yet supported`, [funcProof, argProof]);
      }

      const constraints: Constraint[] = [
        ...funcProof.constraints,
        ...argProof.constraints,
        {left: argProof.type, right: funcType.paramType},
      ];

      return {
        rule: Rule.TPiApp,
        term: node,
        type: substituteTermInType(funcType.body, funcType.paramVar, node.arg),
        gamma: this.schemeContext.serializeGamma(),
        premises: [funcProof, argProof],
        constraints,
      };
    }

    const resultType = this.engine.freshTyMetaVar();

    const expectedFuncType: TyArrow = {
      kind: "TyArrow",
      id: crypto.randomUUID(),
      from: argProof.type,
      to: resultType,
    };

    const constraints: Constraint[] = [
      ...funcProof.constraints,
      ...argProof.constraints,
      {left: funcProof.type, right: expectedFuncType},
    ];

    return {
      rule: this.ruleFor(Rule.App, Rule.CtApp),
      term: node,
      type: resultType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [funcProof, argProof],
      constraints,
    };
  }

  protected visitLit(node: Lit): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Lit, Rule.CtLit), `literal ("${node.value}")`);
    if (gate) return gate;

    const litType = this.literalType(node.value);

    return {
      rule: this.ruleFor(Rule.Lit, Rule.CtLit),
      term: node,
      type: litType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [],
      constraints: [],
    };
  }

  protected visitIfCondition(node: IfCondition): InferProofTree {
    const gate = this.rejectIfUntyped(node, Rule.If, "if/then/else");
    if (gate) return gate;

    const boolType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Bool"};
    const unitType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Unit"};

    const conditionProof = this.visit(node.condition);
    const thenProof = this.visit(node.then);

    const premises: InferProofTree[] = [conditionProof, thenProof];
    const constraints: Constraint[] = [
      ...conditionProof.constraints,
      ...thenProof.constraints,
      {left: conditionProof.type, right: boolType},
    ];

    let resultType: Type = thenProof.type;

    for (const branch of node.elif ?? []) {
      const branchConditionProof = this.visit(branch.condition);
      const branchThenProof = this.visit(branch.then);

      premises.push(branchConditionProof, branchThenProof);
      constraints.push(
        ...branchConditionProof.constraints,
        ...branchThenProof.constraints,
        {left: branchConditionProof.type, right: boolType},
        {left: branchThenProof.type, right: resultType},
      );
    }

    if (node.else) {
      const elseProof = this.visit(node.else);

      premises.push(elseProof);
      constraints.push(
        ...elseProof.constraints,
        {left: elseProof.type, right: resultType},
      );
    } else {
      constraints.push({left: resultType, right: unitType});
      resultType = unitType;
    }

    return {
      rule: this.ruleFor(Rule.If, Rule.CtIf),
      term: node,
      type: resultType,
      gamma: this.schemeContext.serializeGamma(),
      premises,
      constraints,
    };
  }

  protected visitInl(node: Inl): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Inl, Rule.CtInl);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const ascribedType = kindCheck.normalized;

    if (ascribedType.kind !== "SumType") {
      const msg = `"inl" must be ascribed a sum type (e.g. "inl t as T1+T2"), but got ${typeToString(ascribedType)}`;
      return this.reject(node, rule, msg, [termProof]);
    }

    return {
      rule,
      term: node,
      type: ascribedType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: ascribedType.left}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitInr(node: Inr): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Inr, Rule.CtInr);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const ascribedType = kindCheck.normalized;

    if (ascribedType.kind !== "SumType") {
      const msg = `"inr" must be ascribed a sum type (e.g. "inr t as T1+T2"), but got ${typeToString(ascribedType)}`;
      return this.reject(node, rule, msg, [termProof]);
    }

    return {
      rule,
      term: node,
      type: ascribedType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: ascribedType.right}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitCase(node: Case): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Case, Rule.CtCase), "case ... || inl ... || inr ...");
    if (gate) return gate;

    const scrutineeProof = this.visit(node.variable);

    if (scrutineeProof.type.kind !== "SumType") {
      const msg = `"case" scrutinee must have a sum type, but got ${typeToString(scrutineeProof.type)}`;
      return this.reject(node, this.ruleFor(Rule.Case, Rule.CtCase), msg, [scrutineeProof]);
    }

    const scrutineeType = scrutineeProof.type;

    const inlProof = this.withBinding(
      node.inl.variable,
      {kind: "TypeScheme", vars: [], type: scrutineeType.left},
      Rule.CtVar,
      () => this.visit(node.inl.term),
    );

    const inrProof = this.withBinding(
      node.inr.variable,
      {kind: "TypeScheme", vars: [], type: scrutineeType.right},
      Rule.CtVar,
      () => this.visit(node.inr.term),
    );

    return {
      rule: this.ruleFor(Rule.Case, Rule.CtCase),
      term: node,
      type: inlProof.type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [scrutineeProof, inlProof, inrProof],
      constraints: [
        ...scrutineeProof.constraints,
        ...inlProof.constraints,
        ...inrProof.constraints,
        {left: inlProof.type, right: inrProof.type},
      ],
    };
  }

  protected visitVariantCase(node: VariantCase): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.VariantCase, Rule.CtVariantCase), "case ... of [l=x] => ...");
    if (gate) return gate;

    const scrutineeProof = this.visit(node.variable);

    if (scrutineeProof.type.kind !== "VariantType") {
      const msg = `"case" scrutinee must have a variant type, but got ${typeToString(scrutineeProof.type)}`;
      return this.reject(node, this.ruleFor(Rule.VariantCase, Rule.CtVariantCase), msg, [scrutineeProof]);
    }

    const scrutineeType = scrutineeProof.type;
    const premises: InferProofTree[] = [scrutineeProof];
    const constraints: Constraint[] = [...scrutineeProof.constraints];
    const errors: string[] = [];
    let resultType: Type | undefined;

    for (const c of node.cases) {
      const field = scrutineeType.variants.find((v) => v.label === c.label);

      if (!field) {
        errors.push(`Label "${c.label}" is not a member of variant type ${typeToString(scrutineeType)}`);
        const branchProof = this.visit(c.body);
        premises.push(branchProof);
        constraints.push(...branchProof.constraints);
        continue;
      }

      const branchProof = this.withBinding(
        c.variable,
        {kind: "TypeScheme", vars: [], type: field.type},
        Rule.CtVar,
        () => this.visit(c.body),
      );
      premises.push(branchProof);
      constraints.push(...branchProof.constraints);

      if (resultType === undefined) {
        resultType = branchProof.type;
      } else {
        constraints.push({left: resultType, right: branchProof.type});
      }
    }

    const proof: InferProofTree = {
      rule: this.ruleFor(Rule.VariantCase, Rule.CtVariantCase),
      term: node,
      type: resultType ?? ERROR_TYPE,
      gamma: this.schemeContext.serializeGamma(),
      premises,
      constraints,
    };

    if (errors.length > 0) {
      const msg = errors.join("; ");
      this.errorBuffer.push(new TypeCheckError(msg, node.pos));
      proof.error = msg;
    }

    return proof;
  }

  protected visitVariant(node: Variant): InferProofTree {
    const errors: string[] = [];

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      errors.push(kindCheck.message);
    }
    const ascribedType = kindCheck.rejected ? this.expandAliases(node.type) : kindCheck.normalized;

    if (ascribedType.kind !== "VariantType") {
      errors.push(`Variant literal must be ascribed a variant type (e.g. "[l=t] as [l:T, ...]"), but got ${typeToString(ascribedType)}`);
    }

    const constraints: Constraint[] = [];
    const premises: InferProofTree[] = node.variants.map((v) => {
      const termProof = this.visit(v.term);
      constraints.push(...termProof.constraints);

      if (ascribedType.kind === "VariantType") {
        const field = ascribedType.variants.find((f) => f.label === v.label);
        if (!field) {
          errors.push(`Label "${v.label}" is not a member of variant type ${typeToString(ascribedType)}`);
        } else {
          constraints.push({left: termProof.type, right: field.type});
        }
      }

      return termProof;
    });

    const proof: InferProofTree = {
      rule: this.ruleFor(Rule.Variant, Rule.CtVariant),
      term: node,
      type: ascribedType,
      gamma: this.schemeContext.serializeGamma(),
      premises,
      constraints,
      kindPremise: kindCheck.rejected ? undefined : kindCheck.kindPremise,
      typeConversion: kindCheck.rejected ? undefined : kindCheck.conversion,
    };

    if (errors.length > 0) {
      const msg = errors.join("; ");
      this.errorBuffer.push(new TypeCheckError(msg, node.pos));
      proof.error = msg;
    }

    return proof;
  }

  protected visitAscribe(node: Ascribe): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Ascribe, Rule.CtAscribe);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const ascribedType = kindCheck.normalized;

    return {
      rule,
      term: node,
      type: ascribedType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: ascribedType}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitRecordProjection(node: RecordProjection): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.RecordProjection, Rule.CtRecordProjection), "record projection (.label)");
    if (gate) return gate;

    const recordProof = this.visit(node.term);

    if (recordProof.type.kind !== "RecordType") {
      const msg = `Projection ".${node.label}" requires a record type, but got ${typeToString(recordProof.type)}`;
      return this.reject(node, this.ruleFor(Rule.RecordProjection, Rule.CtRecordProjection), msg, [recordProof]);
    }

    const field = recordProof.type.fields.find((f) => f.label === node.label);
    if (!field) {
      const msg = `Record type ${typeToString(recordProof.type)} has no field "${node.label}"`;
      return this.reject(node, this.ruleFor(Rule.RecordProjection, Rule.CtRecordProjection), msg, [recordProof]);
    }

    return {
      rule: this.ruleFor(Rule.RecordProjection, Rule.CtRecordProjection),
      term: node,
      type: field.type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [recordProof],
      constraints: recordProof.constraints,
    };
  }

  protected visitRecord(node: Record): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Record, Rule.CtRecord), "record (<l=t, ...>)");
    if (gate) return gate;

    const fieldProofs = node.fields.map((f) => this.visit(f.term));

    const recordType: RecordType = {
      kind: "RecordType",
      id: crypto.randomUUID(),
      fields: node.fields.map((f, i) => ({label: f.label, type: fieldProofs[i].type})),
    };

    return {
      rule: this.ruleFor(Rule.Record, Rule.CtRecord),
      term: node,
      type: recordType,
      gamma: this.schemeContext.serializeGamma(),
      premises: fieldProofs,
      constraints: fieldProofs.flatMap((p) => p.constraints),
    };
  }

  protected visitTuple(node: Tuple): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Tuple, Rule.CtTuple), "tuple (<t1, t2, ...>)");
    if (gate) return gate;

    const elementProofs = node.elements.map((el) => this.visit(el));

    const tupleType: TupleType = {
      kind: "TupleType",
      id: crypto.randomUUID(),
      elements: elementProofs.map((p) => p.type),
    };

    return {
      rule: this.ruleFor(Rule.Tuple, Rule.CtTuple),
      term: node,
      type: tupleType,
      gamma: this.schemeContext.serializeGamma(),
      premises: elementProofs,
      constraints: elementProofs.flatMap((p) => p.constraints),
    };
  }

  protected visitTupleProjection(node: TupleProjection): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.TupleProjection, Rule.CtTupleProjection), "tuple projection (.N)");
    if (gate) return gate;

    const tupleProof = this.visit(node.tuple);

    if (tupleProof.type.kind !== "TupleType") {
      const msg = `Projection ".${node.index}" requires a tuple type, but got ${typeToString(tupleProof.type)}`;
      return this.reject(node, this.ruleFor(Rule.TupleProjection, Rule.CtTupleProjection), msg, [tupleProof]);
    }

    if (node.index < 1 || node.index > tupleProof.type.elements.length) {
      const msg = `Tuple index ${node.index} is out of bounds for ${typeToString(tupleProof.type)} (valid range: 1..${tupleProof.type.elements.length})`;
      return this.reject(node, this.ruleFor(Rule.TupleProjection, Rule.CtTupleProjection), msg, [tupleProof]);
    }

    return {
      rule: this.ruleFor(Rule.TupleProjection, Rule.CtTupleProjection),
      term: node,
      type: tupleProof.type.elements[node.index - 1],
      gamma: this.schemeContext.serializeGamma(),
      premises: [tupleProof],
      constraints: tupleProof.constraints,
    };
  }

  protected visitSequencing(node: Sequencing): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Sequencing, Rule.CtSequencing), "sequencing (t1; t2)");
    if (gate) return gate;

    const unitType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Unit"};

    const firstProof = this.visit(node.first);
    const secondProof = this.visit(node.second);

    return {
      rule: this.ruleFor(Rule.Sequencing, Rule.CtSequencing),
      term: node,
      type: secondProof.type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [firstProof, secondProof],
      constraints: [
        ...firstProof.constraints,
        ...secondProof.constraints,
        {left: firstProof.type, right: unitType},
      ],
    };
  }

  protected visitDummyAbstraction(node: DummyAbstraction): InferProofTree {
    const rule = this.ruleFor(Rule.DummyAbs, Rule.CtDummyAbs);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.paramType));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message);
    }
    const paramType = kindCheck.normalized;

    const bodyProof = this.visit(node.body);

    const type: TyArrow = {
      kind: "TyArrow",
      id: crypto.randomUUID(),
      from: paramType,
      to: bodyProof.type,
    };

    return {
      rule,
      term: node,
      type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [bodyProof],
      constraints: bodyProof.constraints,
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitBinOp(node: BinOp): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.BinOp, Rule.CtBinOp), `arithmetic/comparison ("${node.operator}")`);
    if (gate) return gate;

    const natType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Nat"};
    const boolType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Bool"};

    const leftProof = this.visit(node.left);
    const rightProof = this.visit(node.right);

    return {
      rule: this.ruleFor(Rule.BinOp, Rule.CtBinOp),
      term: node,
      type: isArithmeticOperator(node.operator) ? natType : boolType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [leftProof, rightProof],
      constraints: [
        ...leftProof.constraints,
        ...rightProof.constraints,
        {left: leftProof.type, right: natType},
        {left: rightProof.type, right: natType},
      ],
    };
  }

  protected visitFix(node: Fix): InferProofTree {
    const gate = this.rejectIfUntyped(node, this.ruleFor(Rule.Fix, Rule.CtFix), "fix");
    if (gate) return gate;

    const termProof = this.visit(node.term);
    const resultType = this.engine.freshTyMetaVar();
    const expectedType: TyArrow = {
      kind: "TyArrow",
      id: crypto.randomUUID(),
      from: resultType,
      to: resultType,
    };

    return {
      rule: this.ruleFor(Rule.Fix, Rule.CtFix),
      term: node,
      type: resultType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: expectedType}],
    };
  }

  // =====================================================================
  // =                        LISTS (Lecture 06)                         =
  // =====================================================================

  protected visitNil(node: Nil): InferProofTree {
    const rule = this.ruleFor(Rule.Nil, Rule.CtNil);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, []);
    }
    const elementType = kindCheck.normalized;
    const listType: Type = {kind: "ListType", id: crypto.randomUUID(), elementType};

    return {
      rule,
      term: node,
      type: listType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [],
      constraints: [],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitCons(node: Cons): InferProofTree {
    const headProof = this.visit(node.head);
    const tailProof = this.visit(node.tail);
    const rule = this.ruleFor(Rule.Cons, Rule.CtCons);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [headProof, tailProof]);
    }
    const elementType = kindCheck.normalized;
    const listType: Type = {kind: "ListType", id: crypto.randomUUID(), elementType};

    return {
      rule,
      term: node,
      type: listType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [headProof, tailProof],
      constraints: [
        ...headProof.constraints,
        ...tailProof.constraints,
        {left: headProof.type, right: elementType},
        {left: tailProof.type, right: listType},
      ],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitIsNil(node: IsNil): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.IsNil, Rule.CtIsNil);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const elementType = kindCheck.normalized;
    const listType: Type = {kind: "ListType", id: crypto.randomUUID(), elementType};
    const boolType: TyIdentifier = {kind: "TyIdentifier", id: crypto.randomUUID(), name: "Bool"};

    return {
      rule,
      term: node,
      type: boolType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: listType}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitHead(node: Head): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Head, Rule.CtHead);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const elementType = kindCheck.normalized;
    const listType: Type = {kind: "ListType", id: crypto.randomUUID(), elementType};

    return {
      rule,
      term: node,
      type: elementType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: listType}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitTail(node: Tail): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Tail, Rule.CtTail);

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const elementType = kindCheck.normalized;
    const listType: Type = {kind: "ListType", id: crypto.randomUUID(), elementType};

    return {
      rule,
      term: node,
      type: listType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: listType}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  // =====================================================================
  // =                 ISO-RECURSIVE TYPES (Lecture 06)                  =
  // =====================================================================

  protected visitFold(node: Fold): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Fold, Rule.CtFold);

    if (!this.theories.isoRecursiveTypes) {
      return this.reject(node, rule, `"fold" is not part of plain STLC — enable the "Iso-recursive types (μ)" theory to use it`, [termProof]);
    }

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const recType = kindCheck.normalized;

    if (recType.kind !== "RecursiveType") {
      const msg = `"fold" must be annotated with a recursive type (e.g. "fold[μX.T] t"), but got ${typeToString(recType)}`;
      return this.reject(node, rule, msg, [termProof]);
    }

    const unfolded = substituteTypeVariable(recType.type, recType.typeVariable, recType);

    return {
      rule,
      term: node,
      type: recType,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: unfolded}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitUnfold(node: Unfold): InferProofTree {
    const termProof = this.visit(node.term);
    const rule = this.ruleFor(Rule.Unfold, Rule.CtUnfold);

    if (!this.theories.isoRecursiveTypes) {
      return this.reject(node, rule, `"unfold" is not part of plain STLC — enable the "Iso-recursive types (μ)" theory to use it`, [termProof]);
    }

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.type));
    if (kindCheck.rejected) {
      return this.reject(node, rule, kindCheck.message, [termProof]);
    }
    const recType = kindCheck.normalized;

    if (recType.kind !== "RecursiveType") {
      const msg = `"unfold" must be annotated with a recursive type (e.g. "unfold[μX.T] t"), but got ${typeToString(recType)}`;
      return this.reject(node, rule, msg, [termProof]);
    }

    const unfolded = substituteTypeVariable(recType.type, recType.typeVariable, recType);

    return {
      rule,
      term: node,
      type: unfolded,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: [...termProof.constraints, {left: termProof.type, right: recType}],
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  protected visitLet(node: Let): InferProofTree {
    if (!this.theories.letPolymorphism) {
      return this.reject(node, Rule.Let, `"let" is not part of plain STLC — enable the Let-polymorphism theory to use it`);
    }

    this.polymorphicScope++;
    try {
      return this.checkLet(node);
    } finally {
      this.polymorphicScope--;
    }
  }

  private checkLet(node: Let): InferProofTree {
    // 1. Infer the bound value's type.
    const valueProof = this.visit(node.value);
    if (valueProof.id) this.rawValueProofs.set(valueProof.id, valueProof);

    let valueSubstitution: Substitution;

    // 2. Solve the value's constraints first — must be fully resolved before generalizing.
    try {
      const solved = this.engine.solve(valueProof.constraints);
      valueSubstitution = solved.substitution;
      this.inferenceSteps.push(...solved.steps);
    } catch (error) {
      this.inferenceSteps.push(...this.engine.getLastSolveSteps());
      const pos = error instanceof TypeCheckError ? error.pos : undefined;
      const msg = error instanceof Error ? error.message : String(error);
      this.errorBuffer.push(new TypeCheckError(msg, pos));

      return {
        rule: Rule.CtLet,
        term: node,
        type: ERROR_TYPE,
        gamma: this.schemeContext.serializeGamma(),
        premises: [valueProof],
        constraints: [],
        error: msg,
      };
    }

    // 3. Apply the substitution to the inferred value type.
    const solvedValueType = this.engine.applySubstitution(
      valueProof.type,
      valueSubstitution,
    );

    // 4. Apply the substitution to the ambient context too — enclosing metavariables may have resolved.
    this.schemeContext = this.engine.applySubstitutionToContext(
      this.schemeContext,
      valueSubstitution,
    );

    // 5. Generalize over metavariables free in the value but not in the surrounding context.
    const generalizedScheme = this.engine.generalize(
      solvedValueType,
      this.schemeContext,
    );

    // 6. Infer the body under the extended context, then drop the binding.
    const bodyProof = this.withBinding(
      node.name,
      generalizedScheme,
      Rule.CtVarLet,
      () => this.visit(node.body),
    );

    // 7. Return the body's type; its still-unsolved constraints are solved by check() or an outer let.
    return {
      rule: Rule.CtLet,
      term: node,
      type: bodyProof.type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [
        this.engine.applySubstitutionToProof(
          valueProof,
          valueSubstitution,
        ),
        bodyProof,
      ],
      constraints: bodyProof.constraints,
    };
  }

  // =====================================================================
  // =                        SYSTEM F                                   =
  // =====================================================================

  protected visitTypeAbstraction(node: TypeAbs): InferProofTree {
    if (!this.theories.systemF) {
      return this.reject(node, Rule.TypeAbs, `"Λ" type abstraction is not part of plain STLC — enable the System F theory to use it`);
    }

    const bodyProof = this.visit(node.body);

    const type: TyForall = {
      kind: "TyForall",
      id: crypto.randomUUID(),
      typeVariable: node.typeParam,
      type: bodyProof.type,
    };

    return {
      rule: Rule.TypeAbs,
      term: node,
      type,
      gamma: this.schemeContext.serializeGamma(),
      premises: [bodyProof],
      constraints: bodyProof.constraints,
    };
  }

  protected visitTypeApplication(node: TypeApp): InferProofTree {
    if (!this.theories.systemF) {
      return this.reject(node, Rule.TypeApp, `"[T]" type application is not part of plain STLC — enable the System F theory to use it`);
    }

    const termProof = this.visit(node.term);

    if (termProof.type.kind !== "TyForall") {
      const msg = `Type application expects a universal type (∀X. T), but got ${typeToString(termProof.type)}`;
      return this.reject(node, Rule.TypeApp, msg, [termProof]);
    }

    const kindCheck = this.checkKindAnnotation(this.expandAliases(node.typeArg));
    if (kindCheck.rejected) {
      return this.reject(node, Rule.TypeApp, kindCheck.message, [termProof]);
    }

    const instantiated = substituteTypeVariable(
      termProof.type.type,
      termProof.type.typeVariable,
      kindCheck.normalized,
    );

    return {
      rule: Rule.TypeApp,
      term: node,
      type: instantiated,
      gamma: this.schemeContext.serializeGamma(),
      premises: [termProof],
      constraints: termProof.constraints,
      kindPremise: kindCheck.kindPremise,
      typeConversion: kindCheck.conversion,
    };
  }

  // =====================================================================
  // =                        SYSTEM λω̲                                  =
  // =====================================================================

  // Unreachable in practice (kind-checking calls kindOf directly); kept for AstVisitor's exhaustiveness.
  protected visitTypeConstructorAbstraction(node: TyConstructorAbs): InferProofTree {
    return this.reject(node, Rule.TyConstructorAbs, `Type constructor abstraction "λ${node.typeParam}:${kindToString(node.paramKind)}. T" is not yet supported`);
  }

  protected visitTypeConstructorApplication(node: TyConstructorApp): InferProofTree {
    return this.reject(node, Rule.TyConstructorApp, `Type constructor application is not yet supported`);
  }

  // =====================================================================

  protected visitType(node: Type): InferProofTree {
    return {
      rule: "Type" as never,
      term: node as never,
      type: node,
      gamma: this.schemeContext.serializeGamma(),
      premises: [],
      constraints: [],
    };
  }

  // Kinds are never visited directly today. Present for AstVisitor's exhaustiveness only.
  protected visitKind(node: Kind): InferProofTree {
    return {
      rule: "Kind" as never,
      term: node as never,
      type: ERROR_TYPE,
      gamma: this.schemeContext.serializeGamma(),
      premises: [],
      constraints: [],
    };
  }

}
