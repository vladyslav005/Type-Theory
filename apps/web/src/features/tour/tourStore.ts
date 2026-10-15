import {useSyncExternalStore} from "react";
import type {TourId} from "@/features/tour/tours.ts";

const SEEN_KEY = "tt.tourSeen";
const listeners = new Set<() => void>();
let active: TourId | null = null;
let seen = readSeen();

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
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
  emit();
}

export function endTour() {
  active = null;
  seen = true;
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode: the tour just keeps its "new" dot.
  }
  emit();
}

export const useActiveTour = () => useSyncExternalStore(subscribe, () => active);
export const useTourSeen = () => useSyncExternalStore(subscribe, () => seen);
