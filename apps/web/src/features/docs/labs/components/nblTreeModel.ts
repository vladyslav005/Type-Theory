import type {NblKind, NblTerm} from "@vladyslav005/tt-core";

export interface Slot {
  kind?: NblKind;
  children: Slot[];
}

export const ARITY: Record<NblKind, number> = {true: 0, false: 0, zero: 0, succ: 1, pred: 1, iszero: 1, if: 3};

export const emptySlot = (): Slot => ({children: []});

// undefined when some slot is still unfilled
export function slotToTerm(slot: Slot): NblTerm | undefined {
  if (!slot.kind) return undefined;
  const children = slot.children.map(slotToTerm);
  if (children.some((child) => !child)) return undefined;
  const [a, b, c] = children as NblTerm[];
  switch (slot.kind) {
    case "true":
    case "false":
    case "zero":
      return {kind: slot.kind};
    case "succ":
    case "pred":
    case "iszero":
      return {kind: slot.kind, arg: a};
    case "if":
      return {kind: "if", cond: a, then: b, else: c};
  }
}

