import {useEffect, useSyncExternalStore} from "react";
import {useLocation} from "react-router-dom";
import {bump, getActivitySnapshot, isCollecting, recordWeek, subscribeActivity} from "@/shared/activity/activityStore.ts";
import {startActivityClock} from "@/shared/activity/activityClock.ts";

export function useActivity() {
  return useSyncExternalStore(subscribeActivity, getActivitySnapshot);
}

// Module-level so StrictMode's double effects and consent changes don't count a visit twice.
let sessionRecorded = false;
let lastRecordedPath: string | undefined;

export function useActivitySession() {
  const {pathname} = useLocation();
  const {consent} = useActivity();

  useEffect(() => {
    startActivityClock();
  }, []);

  useEffect(() => {
    if (sessionRecorded || !isCollecting()) return;
    sessionRecorded = true;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    recordWeek((week) => { week.sessions[mobile ? "mobile" : "desktop"]++; });
  }, [consent]);

  useEffect(() => {
    if (pathname === lastRecordedPath || !isCollecting()) return;
    lastRecordedPath = pathname;
    recordWeek((week) => bump(week.pages, pathname));
  }, [pathname, consent]);
}
