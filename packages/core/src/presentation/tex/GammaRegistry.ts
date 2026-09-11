import type {TexRegistryEntry} from "@/presentation/tex/texTree.ts";
import type {TypeScheme} from "@/application/typecheck/ProofTree.ts";
import type {Kind, Type} from "@/domain/ast";
import {TexMapper, kindToTex} from "@/presentation/tex/TexMapper.ts";

export interface SetRegistration {
  key: string;
  shortTex: string;
  fullTex: string;
  // Set only when this Γ rebinds a name already present in its parent (shadowing) — the UI
  // surfaces this as a hover tooltip, since the underlined recipe entry alone is easy to miss.
  shadowTooltip?: string;
}

// A context entry is either a term binding (x : T) or a type-variable/kind binding (X : K) — the
// lecture treats both as entries of one unified, ordered Γ (type variables before term variables),
// so this registry doesn't distinguish them structurally, only in how each entry renders.
export type ContextValue = Type | TypeScheme | Kind;

function isKindValue(v: ContextValue): v is Kind {
  return v.kind === "StarKind" || v.kind === "KindArrow";
}

function entryToTex(v: ContextValue): string {
  return isKindValue(v) ? kindToTex(v) : TexMapper.typeToTex(v);
}

// Numbers each distinct Γ the first time it's seen while walking a derivation (Γ_1, Γ_2, ...),
// with a "recipe" explaining how it extends its parent (Γ_2 = Γ_1 ∪ {x : Nat}).
export class GammaRegistry {
  readonly registry: Record<string, TexRegistryEntry> = {};
  private readonly bySignature = new Map<string, SetRegistration>();
  private nextIndex = 1;

  private signature(gamma: Record<string, ContextValue>): string {
    return Object.entries(gamma)
      .map(([name, t]) => `${name}:${entryToTex(t)}`)
      .sort()
      .join(",");
  }

  register(
    gamma: Record<string, ContextValue>,
    parentGamma: Record<string, ContextValue> | null,
  ): SetRegistration | null {
    const entries = Object.entries(gamma);
    if (entries.length === 0) {
      return null;
    }

    const signature = this.signature(gamma);
    const existing = this.bySignature.get(signature);
    if (existing) {
      return existing;
    }

    const parentEntries = parentGamma ? Object.entries(parentGamma) : [];
    const parentReg = parentGamma && parentEntries.length > 0
      ? this.bySignature.get(this.signature(parentGamma)) ?? null
      : null;

    // A name present in both but bound to a different value (shadowing) counts as changed too —
    // otherwise a rebound variable is invisible in the recipe (looks like child == parent).
    const parentNames = new Set(parentEntries.map(([name]) => name));
    const parentValues = new Map(parentEntries.map(([name, t]) => [name, entryToTex(t)]));
    const changed = entries.filter(([name, t]) => parentValues.get(name) !== entryToTex(t));
    const freshEntries = changed.filter(([name]) => !parentNames.has(name));
    const reboundEntries = changed.filter(([name]) => parentNames.has(name));

    const index = this.nextIndex++;
    const key = `G${index}`;
    const shortTex = `\\Gamma_{${index}}`;

    // A rebound entry is underlined in the recipe (visual emphasis) rather than given its own
    // notation — it stays inside the same ∪ {...} set as a fresh entry, just marked.
    const changedTexParts = [...freshEntries, ...reboundEntries].map(([name, t]) => {
      const label = `${name} : ${entryToTex(t)}`;
      return parentNames.has(name) ? `\\underline{${label}}` : label;
    });

    const recipe = changedTexParts.length > 0
      ? (parentReg ? `${parentReg.shortTex} \\cup \\{ ${changedTexParts.join(", ")} \\}` : `\\{ ${changedTexParts.join(", ")} \\}`)
      : parentReg
        ? parentReg.shortTex
        : `\\{ ${entries.map(([name, t]) => `${name} : ${entryToTex(t)}`).join(", ")} \\}`;

    const shadowTooltip = reboundEntries.length > 0
      ? reboundEntries.map(([name, t]) => `${name} : ${entryToTex(t)} shadows the earlier ${name} : ${parentValues.get(name)}`).join("; ")
      : undefined;

    const registration: SetRegistration = {key, shortTex, fullTex: `${shortTex} = ${recipe}`, shadowTooltip};
    this.bySignature.set(signature, registration);
    this.registry[key] = {shortTex: registration.shortTex, fullTex: registration.fullTex};
    return registration;
  }

  refFor(gamma: Record<string, ContextValue>): SetRegistration | null {
    if (Object.keys(gamma).length === 0) {
      return null;
    }
    return this.bySignature.get(this.signature(gamma)) ?? null;
  }

  // Clears every registration so this instance can be reused for a fresh derivation.
  reset(): void {
    for (const key of Object.keys(this.registry)) {
      delete this.registry[key];
    }
    this.bySignature.clear();
    this.nextIndex = 1;
  }
}
