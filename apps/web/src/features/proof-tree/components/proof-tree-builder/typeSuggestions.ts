import type {Type, TypeScheme} from "@vladyslav005/tt-core";
import {BASE_TYPES, typeLabel} from "@/features/proof-tree/components/proof-tree-builder/TypeSlotPicker.tsx";

function isInferenceVariable(type: Type): boolean {
  return type.kind === "TyMetaVar" || (type.kind === "TyIdentifier" && type.name.startsWith("'"));
}

function collectVariables(type: Type, out: Type[]): void {
  switch (type.kind) {
    case "TyMetaVar":
    case "TyIdentifier":
      if (isInferenceVariable(type)) out.push(type);
      return;
    case "TyArrow":
      collectVariables(type.from, out);
      collectVariables(type.to, out);
      return;
    case "TupleType":
      type.elements.forEach((e) => collectVariables(e, out));
      return;
    case "SumType":
      collectVariables(type.left, out);
      collectVariables(type.right, out);
      return;
    case "ListType":
      collectVariables(type.elementType, out);
      return;
    case "TyForall":
      collectVariables(type.type, out);
      return;
    default:
      return;
  }
}

// Everything worth offering as a one-click chip: what Γ already mentions, plus whatever the student
// has written on nearby nodes (their own types, never the answer key's), each with its inference
// variables ('A, ...) broken out so they can be reused without retyping.
export function buildTypeSuggestions(
  gamma: Record<string, Type | TypeScheme>,
  written: (Type | undefined)[] = [],
): Type[] {
  const seen = new Map<string, Type>();
  const add = (type: Type) => {
    if (type.kind === "TyIdentifier" && (BASE_TYPES as readonly string[]).includes(type.name)) return;
    seen.set(typeLabel(type), type);
  };

  const all: Type[] = [
    ...Object.values(gamma).map((v) => (v.kind === "TypeScheme" ? v.type : v)),
    ...written.filter((t): t is Type => t !== undefined),
  ];
  for (const type of all) {
    add(type);
    const variables: Type[] = [];
    collectVariables(type, variables);
    variables.forEach(add);
  }
  return [...seen.values()];
}
