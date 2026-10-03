import {useCallback, useState, type SetStateAction} from "react";

// A student's answers per lab task, so an unfinished lab resumes where they left off.
// Kept apart from the activity data; it joins the export only when collection is enabled.
const STORAGE_KEY = "tt.labWork.v1";
const SAVE_DELAY_MS = 500;

function load(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let work = load();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function saveSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(work));
    } catch {
      // Storage full or unavailable — work just won't be restored.
    }
  }, SAVE_DELAY_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(work)); } catch { /* ignore */ }
  });
}

export const getSavedWork = () => work;

export function deleteSavedWork() {
  work = {};
  saveSoon();
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
        if (resolved === undefined) delete work[key];
        else work = {...work, [key]: resolved};
        saveSoon();
      }
      return resolved;
    });
  }, [key]);
  return [value, setValue] as const;
}
