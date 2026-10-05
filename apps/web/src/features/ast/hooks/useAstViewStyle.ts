import {useSyncExternalStore} from "react";

export type AstViewStyle = "cards" | "lecture";

const STORAGE_KEY = "tt.astViewStyle";
const listeners = new Set<() => void>();

function read(): AstViewStyle {
  try {
    return localStorage.getItem(STORAGE_KEY) === "cards" ? "cards" : "lecture";
  } catch {
    return "lecture";
  }
}

let current = read();

export function setAstViewStyle(style: AstViewStyle): void {
  current = style;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // storage unavailable: the choice still holds for this page
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAstViewStyle(): AstViewStyle {
  return useSyncExternalStore(subscribe, () => current, () => "lecture");
}
