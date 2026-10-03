import {useCallback, useRef} from "react";
import {startPracticeSession, updatePracticeSession, type PracticeSession} from "@/shared/activity/activityStore.ts";
import {setWorkTarget} from "@/shared/activity/activityClock.ts";

// An editor practice run (not a lab task). Started on the first interaction, so a practice view
// that is only mounted in the background is never recorded.
export function usePracticeSession(mode: PracticeSession["mode"], term: string, strategy?: string) {
  // One session per term (and mode/strategy): a new term in the editor starts a new session.
  const sessions = useRef(new Map<string, string>());

  const ensure = useCallback(() => {
    const key = `${mode}|${term}|${strategy ?? ""}`;
    let id = sessions.current.get(key);
    if (!id) {
      id = startPracticeSession({mode, term, ...(strategy ? {strategy} : {})});
      if (id) sessions.current.set(key, id);
    }
    return id;
  }, [mode, term, strategy]);

  // Spread onto the practice's container: clicking or typing inside it claims the active time.
  const activityProps = {
    onPointerDown: () => setWorkTarget("practice", ensure()),
    onKeyDown: () => setWorkTarget("practice", ensure()),
  };

  const update = useCallback((change: (session: PracticeSession) => PracticeSession) => updatePracticeSession(ensure(), change), [ensure]);

  return {activityProps, update};
}
