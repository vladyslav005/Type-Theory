import {createContext, useContext, useEffect} from "react";
import {addTaskSeconds, bump, isCollecting, recordWeek, updatePracticeSession} from "@/shared/activity/activityStore.ts";

const TICK_MS = 15000;
const IDLE_AFTER_MS = 2 * 60 * 1000;

let lastInteraction = Date.now();
let started = false;
const activeViews = new Map<string, number>();
// What the student is working on right now: a lab/lecture task id or an editor practice session.
let workTarget: {kind: "task" | "practice"; id: string} | undefined;

function tick() {
  if (!isCollecting() || document.visibilityState !== "visible") return;
  if (Date.now() - lastInteraction > IDLE_AFTER_MS) return;
  const seconds = TICK_MS / 1000;
  recordWeek((week) => {
    week.activeSeconds += seconds;
    activeViews.forEach((_, view) => bump(week.viewSeconds, view, seconds));
  });
  if (workTarget?.kind === "task") addTaskSeconds(workTarget.id, seconds);
  if (workTarget?.kind === "practice") updatePracticeSession(workTarget.id, (session) => ({...session, seconds: session.seconds + seconds}));
}

// A click or key press inside a task/practice claims the time; one anywhere else (captured first) releases it.
export function setWorkTarget(kind: "task" | "practice", id: string | undefined) {
  workTarget = id ? {kind, id} : undefined;
}

export function startActivityClock() {
  if (started) return;
  started = true;
  const touch = () => { lastInteraction = Date.now(); };
  ["pointerdown", "keydown", "wheel", "scroll", "touchstart"].forEach((event) =>
    window.addEventListener(event, touch, {passive: true, capture: true}));
  ["pointerdown", "keydown"].forEach((event) =>
    window.addEventListener(event, () => { workTarget = undefined; }, {passive: true, capture: true}));
  setInterval(tick, TICK_MS);
}

// Dockview keeps hidden panels mounted, so each panel says whether it is actually on screen.
export const ViewVisibleContext = createContext(true);

// Counts seconds while the enclosing panel is on screen and the tab is in use.
export function useViewTime(view: string) {
  const active = useContext(ViewVisibleContext);
  useEffect(() => {
    if (!active) return;
    activeViews.set(view, (activeViews.get(view) ?? 0) + 1);
    return () => {
      const count = (activeViews.get(view) ?? 1) - 1;
      if (count > 0) activeViews.set(view, count);
      else activeViews.delete(view);
    };
  }, [view, active]);
}
