import {useCallback, useState, type SetStateAction} from "react";

// A student's answers per lab task, so an unfinished lab resumes where they left off.
// Kept apart from the activity data; it joins the export only when collection is enabled.
const STORAGE_KEY = "tt.labWork.v1";
const SAVE_DELAY_MS = 500;

function load(raw = readStorage()): Record<string, unknown> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let work = load();
// Keys this tab changed since its last save; only these go on top of what other tabs saved.
let dirty = new Set<string>();
let cleared = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  const merged = cleared ? {} : load();
  dirty.forEach((key) => {
    if (key in work) merged[key] = work[key];
    else delete merged[key];
  });
  work = merged;
  dirty = new Set();
  cleared = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(work));
  } catch {
    // Storage full or unavailable — work just won't be restored.
  }
}

function saveSoon(keys: string[]) {
  keys.forEach((key) => dirty.add(key));
  if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (saveTimer) saveNow(); });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const incoming = load(event.key === null ? readStorage() : event.newValue);
    dirty.forEach((key) => {
      if (key in work) incoming[key] = work[key];
      else delete incoming[key];
    });
    work = incoming;
  });
}

export const getSavedWork = () => work;

// Answers from another browser fill in tasks not worked on here; answers already here are kept.
export function importSavedWork(incoming: unknown): number {
  if (!incoming || typeof incoming !== "object") return 0;
  const added = Object.entries(incoming as Record<string, unknown>).filter(([key]) => !(key in work));
  if (added.length === 0) return 0;
  work = {...work, ...Object.fromEntries(added)};
  saveSoon(added.map(([key]) => key));
  return added.length;
}

export function deleteSavedWork() {
  work = {};
  dirty = new Set();
  cleared = true;
  saveSoon([]);
}

// useState that survives reloads under `key` (a task id plus a field); without a key it is plain state.
export function useSavedState<T>(key: string | undefined, initial: T | (() => T)) {
  const [value, setValueState] = useState<T>(() => {
    if (key && key in work) return work[key] as T;
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  const setValue = useCallback((next: SetStateAction<T>) => {
    setValueState((previous) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;
      if (key) {
        if (resolved === undefined) {
          work = {...work};
          delete work[key];
        } else work = {...work, [key]: resolved};
        saveSoon([key]);
      }
      return resolved;
    });
  }, [key]);
  return [value, setValue] as const;
}
