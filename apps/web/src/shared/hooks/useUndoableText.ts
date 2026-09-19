import {useCallback, useEffect, useRef} from "react";
import type {KeyboardEvent} from "react";

const TYPING_BURST_MS = 500;

const PAIRS: Record<string, string> = {"(": ")", "[": "]", "{": "}"};
const CLOSERS = new Set(Object.values(PAIRS));

// native undo breaks when code rewrites a controlled value, so history is kept here
export function useUndoableText(value: string, onChange: (next: string) => void) {
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastEmitted = useRef(value);
  const lastChange = useRef(0);

  // an external value change (reset, next step) clears the history
  useEffect(() => {
    if (value !== lastEmitted.current) {
      past.current = [];
      future.current = [];
      lastEmitted.current = value;
    }
  }, [value]);

  const change = useCallback((next: string, separate = false) => {
    if (next === value) return;
    const now = Date.now();
    if (separate || past.current.length === 0 || now - lastChange.current > TYPING_BURST_MS) {
      past.current.push(value);
    }
    lastChange.current = separate ? 0 : now;
    future.current = [];
    lastEmitted.current = next;
    onChange(next);
  }, [value, onChange]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (previous === undefined) return;
    future.current.push(value);
    lastEmitted.current = previous;
    lastChange.current = 0;
    onChange(previous);
  }, [value, onChange]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(value);
    lastEmitted.current = next;
    lastChange.current = 0;
    onChange(next);
  }, [value, onChange]);

  const handleBrackets = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return false;
    const el = e.currentTarget;
    const text = el.value;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const place = (next: string, caret: number) => {
      e.preventDefault();
      change(next, true);
      requestAnimationFrame(() => el.setSelectionRange(caret, caret));
    };

    if (e.key in PAIRS) {
      const closer = PAIRS[e.key];
      if (start !== end) {
        place(text.slice(0, start) + e.key + text.slice(start, end) + closer + text.slice(end), end + 2);
      } else {
        place(text.slice(0, start) + e.key + closer + text.slice(end), start + 1);
      }
      return true;
    }
    if (CLOSERS.has(e.key) && start === end && text[start] === e.key) {
      e.preventDefault();
      requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
      return true;
    }
    if (e.key === "Backspace" && start === end && start > 0 && PAIRS[text[start - 1]] === text[start]) {
      place(text.slice(0, start - 1) + text.slice(start + 1), start - 1);
      return true;
    }
    return false;
  }, [change]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (handleBrackets(e)) return true;
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return true;
    }
    if ((key === "z" && e.shiftKey) || key === "y") {
      e.preventDefault();
      redo();
      return true;
    }
    return false;
  }, [handleBrackets, undo, redo]);

  return {change, onKeyDown};
}
