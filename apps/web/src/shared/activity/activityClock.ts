import {createContext, useContext, useEffect} from "react";
import {bump, isCollecting, recordWeek} from "@/shared/activity/activityStore.ts";

const TICK_MS = 15000;
const IDLE_AFTER_MS = 2 * 60 * 1000;

let lastInteraction = Date.now();
let started = false;
const activeViews = new Map<string, number>();

function tick() {
  if (!isCollecting() || document.visibilityState !== "visible") return;
  if (Date.now() - lastInteraction > IDLE_AFTER_MS) return;
  const seconds = TICK_MS / 1000;
  recordWeek((week) => {
    week.activeSeconds += seconds;
    activeViews.forEach((_, view) => bump(week.viewSeconds, view, seconds));
  });
}

export function startActivityClock() {
  if (started) return;
  started = true;
  const touch = () => { lastInteraction = Date.now(); };
  ["pointerdown", "keydown", "wheel", "scroll", "touchstart"].forEach((event) =>
    window.addEventListener(event, touch, {passive: true, capture: true}));
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
