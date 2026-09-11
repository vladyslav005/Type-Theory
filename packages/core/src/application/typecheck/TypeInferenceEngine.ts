
import {
  type Constraint, type InferenceStep, type InferProofTree, type ProofTree,
  type Substitution,
  type TypeScheme,
} from "@/application/typecheck/ProofTree.ts";
import type {Type, TyMetaVar} from "@/domain/ast";
import {Gamma} from "@/application/typecheck/Gamma.ts";
import {kindEquals, metaVarName, normalizeType, termIndexEquals, typeToString} from "@/application/typecheck/utils.ts";
import {TypeCheckError} from "@/application/typecheck/TypeCheckError.ts";

export class TypeInferenceEngine {

  private freshCounter = 0;
  // Live reference to the steps array `solve()` is building, so a caller's catch block can still
  // recover the steps that succeeded before a mid-trace unification failure threw past `solve()`.
  private lastSolveSteps: InferenceStep[] = [];

  // Call at the start of each typecheck run, or metavariable names keep climbing across keystrokes.
  reset(): void {
    this.freshCounter = 0;
  }

  getLastSolveSteps(): InferenceStep[] {
    return this.lastSolveSteps;
  }

  private substitutionToRecord(substitution: Substitution): Record<string, Type> {
    return Object.fromEntries(substitution);
  }

  toSchemeGamma(gamma: Gamma<Type>): Gamma<TypeScheme> {
    const result = new Gamma<TypeScheme>();

    for (const [name, type] of gamma.entries()) {
      result.add(name, {
        kind: "TypeScheme",
        vars: [],
        type,
      });
    }

    return result;
  }

  applySubstitution(type: Type, substitution: Substitution): Type {
    switch (type.kind) {
      case "TyMetaVar": {
        const replacement = substitution.get(type.name);

        if (!replacement) {
          return type;
        }

        return this.applySubstitution(replacement, substitution);
      }

      case "TyIdentifier":
        return type;

      case "TyArrow":
        return {
          ...type,
          from: this.applySubstitution(type.from, substitution),
          to: this.applySubstitution(type.to, substitution),
        };

      case "TupleType":
        return {
          ...type,
          elements: type.elements.map((element) =>
            this.applySubstitution(element, substitution),
          ),
        };

      case "SumType":
        return {
          ...type,
          left: this.applySubstitution(type.left, substitution),
          right: this.applySubstitution(type.right, substitution),
        };

      case "VariantType":
        return {
          ...type,
          variants: type.variants.map((variant) => ({
            ...variant,
            type: this.applySubstitution(variant.type, substitution),
          })),
        };

      case "RecordType":
        return {
          ...type,
          fields: type.fields.map((field) => ({
            ...field,
            type: this.applySubstitution(field.type, substitution),
          })),
        };

      case "TyForall": {
        // The bound variable shadows any substitution entry of the same
        // name — capture-avoiding.
        if (!substitution.has(type.typeVariable)) {
          return {...type, type: this.applySubstitution(type.type, substitution)};
        }

        const inner = new Map(substitution);
        inner.delete(type.typeVariable);
        return {...type, type: this.applySubstitution(type.type, inner)};
      }

      case "TyConstructorAbs": {
        if (!substitution.has(type.typeParam)) {
          return {...type, body: this.applySubstitution(type.body, substitution)};
        }

        const inner = new Map(substitution);
        inner.delete(type.typeParam);
        return {...type, body: this.applySubstitution(type.body, inner)};
      }

      case "TyConstructorApp":
        return {
          ...type,
          func: this.applySubstitution(type.func, substitution),
          arg: this.applySubstitution(type.arg, substitution),
        };

      case "TyPi":
        return {
          ...type,
          paramType: this.applySubstitution(type.paramType, substitution),
          body: this.applySubstitution(type.body, substitution),
        };

      case "TyIndexApp":
        return {...type, func: this.applySubstitution(type.func, substitution)};

      case "ListType":
        return {...type, elementType: this.applySubstitution(type.elementType, substitution)};

      case "RecursiveType": {
        // The bound variable shadows any substitution entry of the same
        // name — capture-avoiding, mirroring TyForall above.
        if (!substitution.has(type.typeVariable)) {
          return {...type, type: this.applySubstitution(type.type, substitution)};
        }

        const inner = new Map(substitution);
        inner.delete(type.typeVariable);
        return {...type, type: this.applySubstitution(type.type, inner)};
      }

      default:
        return this.assertNever(type);
    }
  }

  solve(constraints: Constraint[]): {substitution: Substitution; steps: InferenceStep[]} {
    let substitution: Substitution = new Map();
    const steps: InferenceStep[] = [];
    this.lastSolveSteps = steps;

    for (const constraint of constraints) {
      const substitutionBefore = this.substitutionToRecord(substitution);

      try {
        substitution = this.unify(
          this.applySubstitution(constraint.left, substitution),
          this.applySubstitution(constraint.right, substitution),
          substitution,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({constraint, substitutionBefore, substitutionAfter: substitutionBefore, newBindings: [], affectedNodeIds: [], error: message});
        throw new TypeCheckError(message, constraint.pos);
      }

      const substitutionAfter = this.substitutionToRecord(substitution);
      const newBindings = Object.entries(substitutionAfter)
        .filter(([name]) => !(name in substitutionBefore))
        .map(([name, type]) => ({name, type}));

      // Filled in by STLCTypeChecker once it can compare consecutive proof-tree snapshots.
      steps.push({constraint, substitutionBefore, substitutionAfter, newBindings, affectedNodeIds: []});
    }

    return {substitution, steps};
  }

  unify(
    left: Type,
    right: Type,
    substitution: Substitution,
  ): Substitution {
    const a = normalizeType(this.applySubstitution(left, substitution));
    const b = normalizeType(this.applySubstitution(right, substitution));

    if (a.kind === "TyMetaVar") {
      return this.bindTypeVariable(a.name, b, substitution);
    }

    if (b.kind === "TyMetaVar") {
      return this.bindTypeVariable(b.name, a, substitution);
    }

    if (a.kind === "TyIdentifier" && b.kind === "TyIdentifier") {
      if (a.name === b.name) {
        return substitution;
      }

      throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
    }

    if (a.kind === "TyArrow" && b.kind === "TyArrow") {
      let nextSubstitution = this.unify(a.from, b.from, substitution);

      nextSubstitution = this.unify(
        this.applySubstitution(a.to, nextSubstitution),
        this.applySubstitution(b.to, nextSubstitution),
        nextSubstitution,
      );

      return nextSubstitution;
    }

    if (a.kind === "TupleType" && b.kind === "TupleType") {
      if (a.elements.length !== b.elements.length) {
        throw new Error("Cannot unify tuple types with different lengths");
      }

      let nextSubstitution = substitution;

      for (let i = 0; i < a.elements.length; i++) {
        nextSubstitution = this.unify(
          a.elements[i],
          b.elements[i],
          nextSubstitution,
        );
      }

      return nextSubstitution;
    }

    if (a.kind === "SumType" && b.kind === "SumType") {
      let nextSubstitution = this.unify(a.left, b.left, substitution);

      nextSubstitution = this.unify(
        a.right,
        b.right,
        nextSubstitution,
      );

      return nextSubstitution;
    }

    if (a.kind === "RecordType" && b.kind === "RecordType") {
      if (a.fields.length !== b.fields.length) {
        throw new Error("Cannot unify record types with different fields");
      }

      let nextSubstitution = substitution;

      for (const fieldA of a.fields) {
        const fieldB = b.fields.find((field) => field.label === fieldA.label);

        if (!fieldB) {
          throw new Error(`Record field "${fieldA.label}" is missing`);
        }

        nextSubstitution = this.unify(
          fieldA.type,
          fieldB.type,
          nextSubstitution,
        );
      }

      return nextSubstitution;
    }

    if (a.kind === "VariantType" && b.kind === "VariantType") {
      if (a.variants.length !== b.variants.length) {
        throw new Error("Cannot unify variant types with different labels");
      }

      let nextSubstitution = substitution;

      for (const variantA of a.variants) {
        const variantB = b.variants.find(
          (variant) => variant.label === variantA.label,
        );

        if (!variantB) {
          throw new Error(`Variant label "${variantA.label}" is missing`);
        }

        nextSubstitution = this.unify(
          variantA.type,
          variantB.type,
          nextSubstitution,
        );
      }

      return nextSubstitution;
    }

    if (a.kind === "TyForall" && b.kind === "TyForall") {
      if (a.typeVariable !== b.typeVariable) {
        throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
      }
      return this.unify(a.type, b.type, substitution);
    }

    if (a.kind === "TyConstructorAbs" && b.kind === "TyConstructorAbs") {
      if (a.typeParam !== b.typeParam || !kindEquals(a.paramKind, b.paramKind)) {
        throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
      }
      return this.unify(a.body, b.body, substitution);
    }

    if (a.kind === "TyConstructorApp" && b.kind === "TyConstructorApp") {
      const nextSubstitution = this.unify(a.func, b.func, substitution);
      return this.unify(
        this.applySubstitution(a.arg, nextSubstitution),
        this.applySubstitution(b.arg, nextSubstitution),
        nextSubstitution,
      );
    }

    if (a.kind === "TyPi" && b.kind === "TyPi") {
      if (a.paramVar !== b.paramVar) {
        throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
      }
      const nextSubstitution = this.unify(a.paramType, b.paramType, substitution);
      return this.unify(a.body, b.body, nextSubstitution);
    }

    if (a.kind === "TyIndexApp" && b.kind === "TyIndexApp") {
      if (!termIndexEquals(a.arg, b.arg)) {
        throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
      }
      return this.unify(a.func, b.func, substitution);
    }

    if (a.kind === "ListType" && b.kind === "ListType") {
      return this.unify(a.elementType, b.elementType, substitution);
    }

    if (a.kind === "RecursiveType" && b.kind === "RecursiveType") {
      if (a.typeVariable !== b.typeVariable) {
        throw new Error(`Cannot unify ${typeToString(a)} with ${typeToString(b)}`);
      }
      return this.unify(a.type, b.type, substitution);
    }

    throw new Error(
      `Cannot unify ${typeToString(a)} with ${typeToString(b)}`,
    );
  }

  private bindTypeVariable(
    name: string,
    type: Type,
    substitution: Substitution,
  ): Substitution {
    if (type.kind === "TyMetaVar" && type.name === name) {
      return substitution;
    }

    if (this.occursIn(name, type, substitution)) {
      throw new Error(
        `Occurs check failed: ${name} occurs in ${typeToString(type)}`,
      );
    }

    const nextSubstitution: Substitution = new Map(substitution);
    nextSubstitution.set(name, type);

    return nextSubstitution;
  }

  private occursIn(
    name: string,
    type: Type,
    substitution: Substitution,
  ): boolean {
    const applied = this.applySubstitution(type, substitution);
    return this.freeTypeVariables(applied).has(name);
  }

  private assertNever(value: never): never {
    throw new Error(`Unexpected type kind: ${JSON.stringify(value)}`);
  }

  instantiate(scheme: TypeScheme): Type {
    const substitution: Substitution = new Map();

    for (const variable of scheme.vars) {
      substitution.set(variable, this.freshTyMetaVar());
    }

    return this.applySubstitution(scheme.type, substitution);
  }

   freshTyMetaVar(): TyMetaVar {
    const name = metaVarName(this.freshCounter);
    this.freshCounter++;

    return {
      kind: "TyMetaVar",
      id: crypto.randomUUID(),
      name,
    };
  }

  applySubstitutionToScheme(
    scheme: TypeScheme,
    substitution: Substitution,
  ): TypeScheme {
    const filteredSubstitution: Substitution = new Map(substitution);

    for (const variable of scheme.vars) {
      filteredSubstitution.delete(variable);
    }

    return {
      ...scheme,
      type: this.applySubstitution(scheme.type, filteredSubstitution),
    };
  }

  applySubstitutionToContext(
    context: Gamma<TypeScheme>,
    substitution: Substitution,
  ): Gamma<TypeScheme> {
    const nextContext = new Gamma<TypeScheme>();

    for (const [name, scheme] of context.entries()) {
      nextContext.add(
        name,
        this.applySubstitutionToScheme(scheme, substitution),
      );
    }

    return nextContext;
  }

  applySubstitutionToProof<T extends ProofTree>(
    proof: T,
    substitution: Substitution,
  ): T {
    const next: T = {
      ...proof,
      type: this.applySubstitution(proof.type, substitution),
      premises: proof.premises.map((premise) =>
        this.applySubstitutionToProof(premise, substitution),
      ),
    };

    // Substitute constraints too, or a solved node's final type would sit next to a stale metavariable.
    if ("constraints" in proof) {
      (next as unknown as InferProofTree).constraints = (proof as unknown as InferProofTree).constraints.map(
        (c) => ({
          left: this.applySubstitution(c.left, substitution),
          right: this.applySubstitution(c.right, substitution),
          pos: c.pos,
        }),
      );
    }

    return next;
  }

  freeTypeVariables(type: Type): Set<string> {
    switch (type.kind) {
      case "TyMetaVar":
        return new Set([type.name]);

      case "TyIdentifier":
        return new Set();

      case "TyArrow":
        return this.union(
          this.freeTypeVariables(type.from),
          this.freeTypeVariables(type.to),
        );

      case "TupleType":
        return this.unionMany(
          type.elements.map((element) => this.freeTypeVariables(element)),
        );

      case "SumType":
        return this.union(
          this.freeTypeVariables(type.left),
          this.freeTypeVariables(type.right),
        );

      case "VariantType":
        return this.unionMany(
          type.variants.map((variant) =>
            this.freeTypeVariables(variant.type),
          ),
        );

      case "RecordType":
        return this.unionMany(
          type.fields.map((field) =>
            this.freeTypeVariables(field.type),
          ),
        );

      case "TyForall": {
        const inner = this.freeTypeVariables(type.type);
        inner.delete(type.typeVariable);
        return inner;
      }

      case "TyConstructorAbs": {
        const inner = this.freeTypeVariables(type.body);
        inner.delete(type.typeParam);
        return inner;
      }

      case "TyConstructorApp":
        return this.union(
          this.freeTypeVariables(type.func),
          this.freeTypeVariables(type.arg),
        );

      case "TyPi":
        return this.union(
          this.freeTypeVariables(type.paramType),
          this.freeTypeVariables(type.body),
        );

      case "TyIndexApp":
        return this.freeTypeVariables(type.func);

      case "ListType":
        return this.freeTypeVariables(type.elementType);

      case "RecursiveType": {
        const inner = this.freeTypeVariables(type.type);
        inner.delete(type.typeVariable);
        return inner;
      }

      default:
        return this.assertNever(type);
    }
  }

  freeTypeVariablesScheme(scheme: TypeScheme): Set<string> {
    const variables = this.freeTypeVariables(scheme.type);

    for (const variable of scheme.vars) {
      variables.delete(variable);
    }

    return variables;
  }

  freeTypeVariablesContext(context: Gamma<TypeScheme>): Set<string> {
    const result = new Set<string>();

    for (const [, scheme] of context.entries()) {
      for (const variable of this.freeTypeVariablesScheme(scheme)) {
        result.add(variable);
      }
    }

    return result;
  }

  private union(a: Set<string>, b: Set<string>): Set<string> {
    return new Set([...a, ...b]);
  }

  private unionMany(sets: Set<string>[]): Set<string> {
    const result = new Set<string>();

    for (const set of sets) {
      for (const value of set) {
        result.add(value);
      }
    }

    return result;
  }

  generalize(type: Type, context: Gamma<TypeScheme>): TypeScheme {
    const typeVariables = this.freeTypeVariables(type);
    const contextVariables = this.freeTypeVariablesContext(context);

    const vars = [...typeVariables].filter(
      (variable) => !contextVariables.has(variable),
    );

    return {
      kind: "TypeScheme",
      vars,
      type,
    };
  }

}
