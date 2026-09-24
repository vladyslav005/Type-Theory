import {createContext, useCallback, useContext, useState} from "react";
import {bump, recordAttempt, recordWeek} from "@/shared/activity/activityStore.ts";

// Set by the lab/lecture page, e.g. "lab:nbl" — task ids only need to be unique within one page.
export const TaskScopeContext = createContext<string | undefined>(undefined);

export function useTaskId(id: string | undefined, ...parts: string[]): string | undefined {
  const scope = useContext(TaskScopeContext);
  if (!id) {
    if (import.meta.env.DEV) console.warn("[activity] interactive task without an `id` — its attempts are not tracked");
    return undefined;
  }
  return [scope ?? "unscoped", id, ...parts].join("/");
}

export interface TaskResult {
  ok: boolean;
  kind?: string;
  score?: string;
}

export function trackTask(taskId: string | undefined, result: TaskResult) {
  if (taskId) recordAttempt({task: taskId, ...result});
}

export function trackReveal(taskId: string | undefined) {
  if (taskId) recordAttempt({task: taskId, reveal: true});
}

// Drop-in for useState<Verdict>(): every defined verdict is logged as one attempt.
export function useTrackedVerdict<V extends {ok: boolean; kind?: string} | undefined>(taskId: string | undefined) {
  const [verdict, setVerdictState] = useState<V>();
  const setVerdict = useCallback((next: V) => {
    setVerdictState(() => next);
    if (next) trackTask(taskId, {ok: next.ok, kind: next.ok ? next.kind : next.kind ?? "wrong"});
  }, [taskId]);
  return [verdict, setVerdict] as const;
}

// Exploration widgets have no right answer — only how often each kind is used.
export function trackWidgetUse(widget: string) {
  recordWeek((week) => bump(week.lectureWidgets, widget));
}

export function trackExample(slug: string) {
  recordWeek((week) => bump(week.examples, slug));
}

export type PracticeEvent =
  | {type: "step"; ok: boolean}
  | {type: "unreadable"}
  | {type: "check"; outcome: "match" | "mismatch" | "unreadable"}
  | {type: "reveal"; what: "step" | "all"}
  | {type: "completed"; allCorrect: boolean};

// Step-by-step evaluation practice: per-task attempts inside labs, weekly counters in the editor.
export function trackPractice(taskId: string | undefined, event: PracticeEvent) {
  if (taskId) {
    switch (event.type) {
      case "step": return trackTask(taskId, {ok: event.ok, kind: event.ok ? "step" : "wrongStep"});
      case "unreadable": return trackTask(taskId, {ok: false, kind: "cannotRead"});
      case "check": return trackTask(taskId, {ok: event.outcome === "match", kind: `check:${event.outcome}`});
      case "reveal": return recordAttempt({task: taskId, reveal: true, kind: event.what});
      case "completed": return trackTask(taskId, {ok: event.allCorrect, kind: event.allCorrect ? "normalForm" : "normalFormWithMistakes"});
    }
  }
  recordWeek((week) => {
    const practice = week.evalPractice;
    switch (event.type) {
      case "step": practice[event.ok ? "ok" : "wrong"]++; break;
      case "unreadable": practice.unreadable++; break;
      case "check": bump(practice.checks, event.outcome); break;
      case "reveal": bump(practice.reveals, event.what); break;
      case "completed": practice.completed++; if (event.allCorrect) practice.completedAllCorrect++; break;
    }
  });
}
