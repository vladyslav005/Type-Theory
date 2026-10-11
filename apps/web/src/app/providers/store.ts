import {configureStore} from "@reduxjs/toolkit";
import termReducer, {initialTermState} from "@/shared/ui-state/termSlice";
import {loadPersistedTermState, persistTermState} from "@/shared/ui-state/persistTermState.ts";
import workspaceLayoutReducer from "@/shared/ui-state/workspaceLayoutSlice.ts";
import {activityListener} from "@/shared/activity/activityListener.ts";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";

const persisted = loadPersistedTermState();

const LARGE_PATHS = ["term.evaluation", "term.proof", "term.ast", "term.inferenceSteps", "term.inferenceProofSnapshots"];

export const store = configureStore({
  reducer: {
    term: termReducer,
    workspaceLayoutUi: workspaceLayoutReducer,
  },
  preloadedState: persisted
    ? {term: {...initialTermState, ...persisted, ...(STUDY_MODE && {autoBuild: false})}}
    : undefined,
  // Dev-only checks deep-walk the whole state on every action; evaluation traces and proofs run to ~100k nodes.
  middleware: (getDefault) => getDefault({
    immutableCheck: {ignoredPaths: LARGE_PATHS},
    serializableCheck: {ignoredPaths: LARGE_PATHS, ignoredActionPaths: ["payload", "meta.arg", "meta.baseQueryMeta"]},
  }).prepend(activityListener.middleware),
});

store.subscribe(() => {
  persistTermState(store.getState().term);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
