import {isKind} from "@/domain/ast";
import type {BinaryOperator, Kind, Term, Type} from "@/domain/ast";

// A TyIndexApp's term index is always a Var or a Lit, so this never needs full term evaluation.
export function termIndexEquals(a: Term, b: Term): boolean {
  if (a.kind === "Var" && b.kind === "Var") return a.name === b.name;
  if (a.kind === "Lit" && b.kind === "Lit") return a.value === b.value;
  return false;
}

export function termIndexToString(t: Term): string {
  if (t.kind === "Var") return t.name;
  if (t.kind === "Lit") return t.value;
  throw new Error(`Unsupported System λP index expression: ${t.kind}`);
}

const ARITHMETIC_OPERATORS: ReadonlySet<BinaryOperator> = new Set(["+", "-", "*", "/"]);

// Arithmetic operators type as Nat -> Nat -> Nat; comparisons type as Nat -> Nat -> Bool.
export function isArithmeticOperator(operator: BinaryOperator): boolean {
  return ARITHMETIC_OPERATORS.has(operator);
}

// 'C' is skipped: it's reserved for constraint sets (C_1, C_2, ...) in proof-tree rendering.
const META_VAR_ALPHABET = "ABDEFGHIJKLMNOPQRSTUVWXYZ";

export function metaVarName(index: number): string {
  const letter = META_VAR_ALPHABET[index % META_VAR_ALPHABET.length];
  const cycle = Math.floor(index / META_VAR_ALPHABET.length);
  return cycle === 0 ? `'${letter}` : `'${letter}_${cycle}`;
}

export function typeEquals(a: Type, b: Type): boolean {
  a = normalizeType(a);
  b = normalizeType(b);
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "TyIdentifier":
      return a.name === (b as any).name;

    case "TyArrow":
      return (
        typeEquals(a.from, (b as any).from) &&
        typeEquals(a.to, (b as any).to)
      );

    case "TupleType": {
      const bElements = (b as typeof a).elements;
      return (
        a.elements.length === bElements.length &&
        a.elements.every((el, i) => typeEquals(el, bElements[i]))
      );
    }

    case "SumType": {
      const bSum = b as typeof a;
      return typeEquals(a.left, bSum.left) && typeEquals(a.right, bSum.right);
    }

    case "VariantType": {
      const bVariants = (b as typeof a).variants;
      if (a.variants.length !== bVariants.length) return false;
      return a.variants.every((v) => {
        const match = bVariants.find((bv) => bv.label === v.label);
        return match !== undefined && typeEquals(v.type, match.type);
      });
    }

    case "RecordType": {
      const bFields = (b as typeof a).fields;
      if (a.fields.length !== bFields.length) return false;
      return a.fields.every((f) => {
        const match = bFields.find((bf) => bf.label === f.label);
        return match !== undefined && typeEquals(f.type, match.type);
      });
    }

    case "TyMetaVar" : {
      return a.name === (b as any).name;
    }

    case "TyForall": {
      const bForall = b as typeof a;
      // Structural equality only — no alpha-conversion.
      return a.typeVariable === bForall.typeVariable && typeEquals(a.type, bForall.type);
    }

    case "TyConstructorAbs": {
      const bAbs = b as typeof a;
      return a.typeParam === bAbs.typeParam && typeEquals(a.body, bAbs.body);
    }

    case "TyConstructorApp": {
      const bApp = b as typeof a;
      return typeEquals(a.func, bApp.func) && typeEquals(a.arg, bApp.arg);
    }

    case "TyPi": {
      const bPi = b as typeof a;
      return (
        a.paramVar === bPi.paramVar &&
        typeEquals(a.paramType, bPi.paramType) &&
        typeEquals(a.body, bPi.body)
      );
    }

    case "TyIndexApp": {
      const bIdx = b as typeof a;
      return typeEquals(a.func, bIdx.func) && termIndexEquals(a.arg, bIdx.arg);
    }

    case "ListType": {
      const bList = b as typeof a;
      return typeEquals(a.elementType, bList.elementType);
    }

    case "RecursiveType": {
      const bMu = b as typeof a;
      // Structural equality only — no alpha-conversion.
      return a.typeVariable === bMu.typeVariable && typeEquals(a.type, bMu.type);
    }
  }
}

export function typeToString(a: Type): string {
  switch (a.kind) {
    case "TyIdentifier":
      return a.name;

    case "TyArrow": {
      const fromStr = typeToString(a.from);
      const toStr = typeToString(a.to);
      return `(${fromStr} -> ${toStr})`;
    }

    case "TupleType":
      return `<${a.elements.map(typeToString).join(" * ")}>`;

    case "SumType":
      return `(${typeToString(a.left)} + ${typeToString(a.right)})`;

    case "VariantType":
      return `[${a.variants.map((v) => `${v.label}: ${typeToString(v.type)}`).join(", ")}]`;

    case "RecordType":
      return `<${a.fields.map((f) => `${f.label}: ${typeToString(f.type)}`).join(", ")}>`;

    case "TyMetaVar":
      return a.name;

    case "TyForall":
      return `(forall ${a.typeVariable}. ${typeToString(a.type)})`;

    case "TyConstructorAbs":
      return `(\\${a.typeParam} : ${kindToString(a.paramKind)} . ${typeToString(a.body)})`;

    case "TyConstructorApp":
      return `(${typeToString(a.func)} ${typeToString(a.arg)})`;

    case "TyPi":
      return `(Π ${a.paramVar}:${typeToString(a.paramType)}. ${typeToString(a.body)})`;

    case "TyIndexApp":
      return `(${typeToString(a.func)}[${termIndexToString(a.arg)}])`;

    case "ListType":
      return `(List ${typeToString(a.elementType)})`;

    case "RecursiveType":
      return `(μ${a.typeVariable}. ${typeToString(a.type)})`;
  }
}

// "@" (not "*", reserved for MUL/tuple) is the concrete syntax for the kind of types.
export function kindToString(k: Kind): string {
  switch (k.kind) {
    case "StarKind":
      return "@";
    case "KindArrow":
      return `(${isKind(k.from) ? kindToString(k.from) : typeToString(k.from)} -> ${kindToString(k.to)})`;
  }
}

export function kindEquals(a: Kind, b: Kind): boolean {
  if (a.kind === "StarKind" && b.kind === "StarKind") {
    return true;
  }
  if (a.kind === "KindArrow" && b.kind === "KindArrow") {
    if (isKind(a.from) && isKind(b.from)) {
      return kindEquals(a.from, b.from) && kindEquals(a.to, b.to);
    }
    if (!isKind(a.from) && !isKind(b.from)) {
      return typeEquals(a.from, b.from) && kindEquals(a.to, b.to);
    }
    return false;
  }
  return false;
}

// Gates kind-checking so an ordinary type (kind trivially *) never shows a kind derivation.
export function containsTypeConstructor(type: Type): boolean {
  switch (type.kind) {
    case "TyIdentifier":
    case "TyMetaVar":
      return false;
    case "TyArrow":
      return containsTypeConstructor(type.from) || containsTypeConstructor(type.to);
    case "TupleType":
      return type.elements.some(containsTypeConstructor);
    case "SumType":
      return containsTypeConstructor(type.left) || containsTypeConstructor(type.right);
    case "VariantType":
      return type.variants.some((v) => containsTypeConstructor(v.type));
    case "RecordType":
      return type.fields.some((f) => containsTypeConstructor(f.type));
    case "TyForall":
      return containsTypeConstructor(type.type);
    case "TyConstructorAbs":
    case "TyConstructorApp":
      return true;
    case "TyPi":
      return containsTypeConstructor(type.paramType) || containsTypeConstructor(type.body);
    case "TyIndexApp":
      return containsTypeConstructor(type.func);
    case "ListType":
      return containsTypeConstructor(type.elementType);
    case "RecursiveType":
      return containsTypeConstructor(type.type);
  }
}

// Whether `type` mentions a λP construct (Π-type or term-indexed application) — gates λP diagnostics.
export function containsLambdaPConstruct(type: Type): boolean {
  switch (type.kind) {
    case "TyIdentifier":
    case "TyMetaVar":
      return false;
    case "TyArrow":
      return containsLambdaPConstruct(type.from) || containsLambdaPConstruct(type.to);
    case "TupleType":
      return type.elements.some(containsLambdaPConstruct);
    case "SumType":
      return containsLambdaPConstruct(type.left) || containsLambdaPConstruct(type.right);
    case "VariantType":
      return type.variants.some((v) => containsLambdaPConstruct(v.type));
    case "RecordType":
      return type.fields.some((f) => containsLambdaPConstruct(f.type));
    case "TyForall":
      return containsLambdaPConstruct(type.type);
    case "TyConstructorAbs":
      return containsLambdaPConstruct(type.body);
    case "TyConstructorApp":
      return containsLambdaPConstruct(type.func) || containsLambdaPConstruct(type.arg);
    case "TyPi":
    case "TyIndexApp":
      return true;
    case "ListType":
      return containsLambdaPConstruct(type.elementType);
    case "RecursiveType":
      return containsLambdaPConstruct(type.type);
  }
}

// Capture-avoiding substitution of a type variable (TyIdentifier by name) with a concrete type.
export function substituteTypeVariable(type: Type, name: string, replacement: Type): Type {
  switch (type.kind) {
    case "TyIdentifier":
      return type.name === name ? replacement : type;

    case "TyMetaVar":
      return type;

    case "TyArrow":
      return {
        ...type,
        from: substituteTypeVariable(type.from, name, replacement),
        to: substituteTypeVariable(type.to, name, replacement),
      };

    case "TupleType":
      return {
        ...type,
        elements: type.elements.map((element) => substituteTypeVariable(element, name, replacement)),
      };

    case "SumType":
      return {
        ...type,
        left: substituteTypeVariable(type.left, name, replacement),
        right: substituteTypeVariable(type.right, name, replacement),
      };

    case "VariantType":
      return {
        ...type,
        variants: type.variants.map((variant) => ({
          ...variant,
          type: substituteTypeVariable(variant.type, name, replacement),
        })),
      };

    case "RecordType":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: substituteTypeVariable(field.type, name, replacement),
        })),
      };

    case "TyForall":
      // The bound variable shadows an outer variable of the same name.
      if (type.typeVariable === name) {
        return type;
      }
      return {...type, type: substituteTypeVariable(type.type, name, replacement)};

    case "TyConstructorAbs":
      if (type.typeParam === name) {
        return type;
      }
      return {...type, body: substituteTypeVariable(type.body, name, replacement)};

    case "TyConstructorApp":
      return {
        ...type,
        func: substituteTypeVariable(type.func, name, replacement),
        arg: substituteTypeVariable(type.arg, name, replacement),
      };

    case "TyPi":
      // paramVar is a *term*-variable name — a different namespace from
      // the type variable being substituted here, so it never shadows.
      return {
        ...type,
        paramType: substituteTypeVariable(type.paramType, name, replacement),
        body: substituteTypeVariable(type.body, name, replacement),
      };

    case "TyIndexApp":
      // arg is a Term, not a Type — untouched by a type-variable substitution.
      return {...type, func: substituteTypeVariable(type.func, name, replacement)};

    case "ListType":
      return {...type, elementType: substituteTypeVariable(type.elementType, name, replacement)};

    case "RecursiveType":
      // The bound variable shadows an outer variable of the same name.
      if (type.typeVariable === name) {
        return type;
      }
      return {...type, type: substituteTypeVariable(type.type, name, replacement)};
  }
}

// Whether `type` mentions `name` as a free term-index — used by visitAbs to decide whether a λ's
// inferred type must be a dependent TyPi (e.g. "λn:Nat. λx:Vec[n]. n") rather than a plain TyArrow.
export function containsFreeTermVar(type: Type, name: string): boolean {
  switch (type.kind) {
    case "TyIdentifier":
    case "TyMetaVar":
      return false;
    case "TyArrow":
      return containsFreeTermVar(type.from, name) || containsFreeTermVar(type.to, name);
    case "TupleType":
      return type.elements.some((e) => containsFreeTermVar(e, name));
    case "SumType":
      return containsFreeTermVar(type.left, name) || containsFreeTermVar(type.right, name);
    case "VariantType":
      return type.variants.some((v) => containsFreeTermVar(v.type, name));
    case "RecordType":
      return type.fields.some((f) => containsFreeTermVar(f.type, name));
    case "TyForall":
      return containsFreeTermVar(type.type, name);
    case "TyConstructorAbs":
      return containsFreeTermVar(type.body, name);
    case "TyConstructorApp":
      return containsFreeTermVar(type.func, name) || containsFreeTermVar(type.arg, name);
    case "TyPi":
      // The bound term variable shadows an outer one of the same name.
      if (type.paramVar === name) return false;
      return containsFreeTermVar(type.paramType, name) || containsFreeTermVar(type.body, name);
    case "TyIndexApp":
      return containsFreeTermVar(type.func, name) || (type.arg.kind === "Var" && type.arg.name === name);
    case "ListType":
      return containsFreeTermVar(type.elementType, name);
    case "RecursiveType":
      return containsFreeTermVar(type.type, name);
  }
}

// Capture-avoiding substitution of a term variable inside a Type — needed when a Πx:A.B-typed
// function is applied and the argument term is substituted for x inside the dependent result type B.
export function substituteTermInType(type: Type, name: string, replacement: Term): Type {
  switch (type.kind) {
    case "TyIdentifier":
    case "TyMetaVar":
      return type;

    case "TyArrow":
      return {
        ...type,
        from: substituteTermInType(type.from, name, replacement),
        to: substituteTermInType(type.to, name, replacement),
      };

    case "TupleType":
      return {...type, elements: type.elements.map((element) => substituteTermInType(element, name, replacement))};

    case "SumType":
      return {
        ...type,
        left: substituteTermInType(type.left, name, replacement),
        right: substituteTermInType(type.right, name, replacement),
      };

    case "VariantType":
      return {
        ...type,
        variants: type.variants.map((variant) => ({
          ...variant,
          type: substituteTermInType(variant.type, name, replacement),
        })),
      };

    case "RecordType":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: substituteTermInType(field.type, name, replacement),
        })),
      };

    case "TyForall":
      return {...type, type: substituteTermInType(type.type, name, replacement)};

    case "TyConstructorAbs":
      return {...type, body: substituteTermInType(type.body, name, replacement)};

    case "TyConstructorApp":
      return {
        ...type,
        func: substituteTermInType(type.func, name, replacement),
        arg: substituteTermInType(type.arg, name, replacement),
      };

    case "TyPi":
      // The bound term variable shadows an outer one of the same name.
      if (type.paramVar === name) {
        return type;
      }
      return {
        ...type,
        paramType: substituteTermInType(type.paramType, name, replacement),
        body: substituteTermInType(type.body, name, replacement),
      };

    case "TyIndexApp":
      return {
        ...type,
        func: substituteTermInType(type.func, name, replacement),
        arg: type.arg.kind === "Var" && type.arg.name === name ? replacement : type.arg,
      };

    case "ListType":
      return {...type, elementType: substituteTermInType(type.elementType, name, replacement)};

    case "RecursiveType":
      return {...type, type: substituteTermInType(type.type, name, replacement)};
  }
}

// Expands any TyIdentifier naming a registered `typedef` into its underlying type, recursively.
// `seen` guards against a cyclic typedef chain looping forever.
export function expandTypeAliases(type: Type, aliases: ReadonlyMap<string, Type>, seen: ReadonlySet<string> = new Set()): Type {
  switch (type.kind) {
    case "TyIdentifier": {
      const target = aliases.get(type.name);
      if (!target || seen.has(type.name)) {
        return type;
      }
      return expandTypeAliases(target, aliases, new Set([...seen, type.name]));
    }

    case "TyMetaVar":
      return type;

    case "TyArrow":
      return {
        ...type,
        from: expandTypeAliases(type.from, aliases, seen),
        to: expandTypeAliases(type.to, aliases, seen),
      };

    case "TupleType":
      return {
        ...type,
        elements: type.elements.map((element) => expandTypeAliases(element, aliases, seen)),
      };

    case "SumType":
      return {
        ...type,
        left: expandTypeAliases(type.left, aliases, seen),
        right: expandTypeAliases(type.right, aliases, seen),
      };

    case "VariantType":
      return {
        ...type,
        variants: type.variants.map((variant) => ({
          ...variant,
          type: expandTypeAliases(variant.type, aliases, seen),
        })),
      };

    case "RecordType":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: expandTypeAliases(field.type, aliases, seen),
        })),
      };

    case "TyForall":
      return {...type, type: expandTypeAliases(type.type, aliases, seen)};

    case "TyConstructorAbs":
      return {...type, body: expandTypeAliases(type.body, aliases, seen)};

    case "TyConstructorApp":
      return {
        ...type,
        func: expandTypeAliases(type.func, aliases, seen),
        arg: expandTypeAliases(type.arg, aliases, seen),
      };

    case "TyPi":
      return {
        ...type,
        paramType: expandTypeAliases(type.paramType, aliases, seen),
        body: expandTypeAliases(type.body, aliases, seen),
      };

    case "TyIndexApp":
      return {...type, func: expandTypeAliases(type.func, aliases, seen)};

    case "ListType":
      return {...type, elementType: expandTypeAliases(type.elementType, aliases, seen)};

    case "RecursiveType":
      return {...type, type: expandTypeAliases(type.type, aliases, seen)};
  }
}

// Beta-reduces any TyConstructorApp((λX:K.T), T') to T[X:=T'], recursively. A "stuck" application
// (func is a bound type-constructor variable, not an abstraction) is left as-is.
export function normalizeType(type: Type): Type {
  switch (type.kind) {
    case "TyIdentifier":
    case "TyMetaVar":
      return type;

    case "TyArrow":
      return {...type, from: normalizeType(type.from), to: normalizeType(type.to)};

    case "TupleType":
      return {...type, elements: type.elements.map((e) => normalizeType(e))};

    case "SumType":
      return {...type, left: normalizeType(type.left), right: normalizeType(type.right)};

    case "VariantType":
      return {...type, variants: type.variants.map((v) => ({...v, type: normalizeType(v.type)}))};

    case "RecordType":
      return {...type, fields: type.fields.map((f) => ({...f, type: normalizeType(f.type)}))};

    case "TyForall":
      return {...type, type: normalizeType(type.type)};

    case "TyConstructorAbs":
      return {...type, body: normalizeType(type.body)};

    case "TyConstructorApp": {
      const func = normalizeType(type.func);
      const arg = normalizeType(type.arg);
      if (func.kind === "TyConstructorAbs") {
        return normalizeType(substituteTypeVariable(func.body, func.typeParam, arg));
      }
      return {...type, func, arg};
    }

    case "TyPi":
      return {...type, paramType: normalizeType(type.paramType), body: normalizeType(type.body)};

    case "TyIndexApp":
      return {...type, func: normalizeType(type.func)};

    case "ListType":
      return {...type, elementType: normalizeType(type.elementType)};

    case "RecursiveType":
      return {...type, type: normalizeType(type.type)};
  }
}