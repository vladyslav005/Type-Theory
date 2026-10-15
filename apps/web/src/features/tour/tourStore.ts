import {useSyncExternalStore} from "react";
import type {TourId} from "@/features/tour/tours.ts";

const SEEN_KEY = "tt.tourSeen";
const HINT_KEY = "tt.tourHintDismissed";
const listeners = new Set<() => void>();
let active: TourId | null = null;
let seen = readFlag(SEEN_KEY);
let hintDismissed = readFlag(HINT_KEY);

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode: the flag only lasts for this page load.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startTour(id: TourId) {
  active = id;
  dismissTourHint();
  emit();
}

export function endTour() {
  active = null;
  seen = true;
  writeFlag(SEEN_KEY);
  emit();
}

export function dismissTourHint() {
  if (hintDismissed) return;
  hintDismissed = true;
  writeFlag(HINT_KEY);
  emit();
}

export const useActiveTour = () => useSyncExternalStore(subscribe, () => active);
export const useTourSeen = () => useSyncExternalStore(subscribe, () => seen);
// The first-visit pointer to the tutorials, until it's dismissed or a tutorial has been taken.
export const useTourHintWanted = () => useSyncExternalStore(subscribe, () => !seen && !hintDismissed && active === null);
