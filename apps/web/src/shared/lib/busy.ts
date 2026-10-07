import {useSyncExternalStore} from "react";
import {afterPaint} from "@/shared/lib/afterPaint.ts";

export type BusyScope = "evaluation" | "proofTree" | "ast";

const counts = new Map<BusyScope, number>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Marks a panel busy, lets its overlay paint, then does the (possibly freezing) work.
export function runBusy(scope: BusyScope, work: () => void) {
  counts.set(scope, (counts.get(scope) ?? 0) + 1);
  notify();
  afterPaint(() => {
    try {
      work();
    } finally {
      counts.set(scope, (counts.get(scope) ?? 1) - 1);
      notify();
    }
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useBusy(scope: BusyScope): boolean {
  return useSyncExternalStore(subscribe, () => (counts.get(scope) ?? 0) > 0, () => false);
}
