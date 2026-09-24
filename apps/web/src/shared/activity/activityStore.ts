import {version as appVersion} from "../../../package.json";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";

const STORAGE_KEY = "tt.activity.v1";
const SCHEMA_VERSION = 1;
const MAX_ATTEMPTS = 20000;
const SAVE_DELAY_MS = 2000;

export type Consent = "unset" | "granted" | "denied";

export type Counts = Record<string, number>;

export interface WeekStats {
  activeSeconds: number;
  viewSeconds: Counts;
  pages: Counts;
  typecheck: {ok: number; failed: number; parseFailed: number; failedRules: Counts; streaks: Counts};
  evaluate: Counts;
  theoriesEnabled: Counts;
  examples: Counts;
  buildMode: {entered: Counts; checks: number; ok: Counts; wrong: Counts; messages: Counts; completed: Counts; checksToComplete: Counts};
  evalPractice: {ok: number; wrong: number; unreadable: number; checks: Counts; reveals: Counts; completed: number; completedAllCorrect: number};
  lectureWidgets: Counts;
  sessions: {mobile: number; desktop: number};
}

// sec = seconds since this task's first recorded event, never a wall-clock time.
export interface Attempt {
  task: string;
  week: string;
  sec: number;
  ok?: boolean;
  kind?: string;
  score?: string;
  reveal?: true;
}

export interface ActivityData {
  weeks: Record<string, WeekStats>;
  attempts: Attempt[];
  truncated?: true;
}

interface StoredActivity {
  consent: Consent;
  data: ActivityData;
  // Local bookkeeping only, stripped from the export.
  taskFirstSeen: Record<string, number>;
  failureStreak: number;
}

const emptyData = (): ActivityData => ({weeks: {}, attempts: []});

const emptyWeek = (): WeekStats => ({
  activeSeconds: 0,
  viewSeconds: {},
  pages: {},
  typecheck: {ok: 0, failed: 0, parseFailed: 0, failedRules: {}, streaks: {}},
  evaluate: {},
  theoriesEnabled: {},
  examples: {},
  buildMode: {entered: {}, checks: 0, ok: {}, wrong: {}, messages: {}, completed: {}, checksToComplete: {}},
  evalPractice: {ok: 0, wrong: 0, unreadable: 0, checks: {}, reveals: {}, completed: 0, completedAllCorrect: 0},
  lectureWidgets: {},
  sessions: {mobile: 0, desktop: 0},
});

export function isoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const bump = (counts: Counts, key: string, by = 1) => {
  counts[key] = (counts[key] ?? 0) + by;
};

export const countBucket = (n: number) => (n === 1 ? "1" : n <= 3 ? "2-3" : n <= 7 ? "4-7" : "8+");

// Fills fields added to WeekStats after a week was first stored.
function withDefaults<T>(defaults: T, stored: unknown): T {
  if (typeof defaults !== "object" || defaults === null || typeof stored !== "object" || stored === null) {
    return (stored ?? defaults) as T;
  }
  const merged = {...defaults, ...stored} as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    merged[key] = withDefaults((defaults as Record<string, unknown>)[key], (stored as Record<string, unknown>)[key]);
  }
  return merged as T;
}

function load(): StoredActivity {
  const fallback: StoredActivity = {consent: "unset", data: emptyData(), taskFirstSeen: {}, failureStreak: 0};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredActivity>;
    return {
      consent: parsed.consent === "granted" || parsed.consent === "denied" ? parsed.consent : "unset",
      data: parsed.data && typeof parsed.data === "object" ? {...emptyData(), ...parsed.data} : emptyData(),
      taskFirstSeen: parsed.taskFirstSeen ?? {},
      failureStreak: typeof parsed.failureStreak === "number" ? parsed.failureStreak : 0,
    };
  } catch {
    return fallback;
  }
}

let state = load();
let snapshot = {consent: state.consent, data: state.data};
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function saveNow() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — stats just won't persist.
  }
}

function changed(immediate = false) {
  snapshot = {consent: state.consent, data: state.data};
  listeners.forEach((listener) => listener());
  if (immediate) saveNow();
  else if (!saveTimer) saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => { if (saveTimer) saveNow(); });
}

export const isCollecting = () => STUDY_MODE && state.consent === "granted";

export function subscribeActivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getActivitySnapshot = () => snapshot;

export function setConsent(consent: Consent) {
  state = {...state, consent};
  changed(true);
}

export function deleteActivityData() {
  state = {...state, data: emptyData(), taskFirstSeen: {}, failureStreak: 0};
  changed(true);
}

// Mutates a fresh copy so the snapshot handed to React always changes identity.
export function recordWeek(update: (week: WeekStats, internal: {failureStreak: number}) => void) {
  if (!isCollecting()) return;
  const key = isoWeek();
  const week = withDefaults(emptyWeek(), structuredClone(state.data.weeks[key]));
  const internal = {failureStreak: state.failureStreak};
  update(week, internal);
  state = {...state, failureStreak: internal.failureStreak, data: {...state.data, weeks: {...state.data.weeks, [key]: week}}};
  changed();
}

export function recordAttempt(attempt: Omit<Attempt, "week" | "sec">) {
  if (!isCollecting()) return;
  if (state.data.attempts.length >= MAX_ATTEMPTS) {
    if (!state.data.truncated) {
      state = {...state, data: {...state.data, truncated: true}};
      changed();
    }
    return;
  }
  const now = Date.now();
  const firstSeen = state.taskFirstSeen[attempt.task] ?? now;
  const entry: Attempt = {...attempt, week: isoWeek(), sec: Math.round((now - firstSeen) / 1000)};
  state = {
    ...state,
    taskFirstSeen: {...state.taskFirstSeen, [attempt.task]: firstSeen},
    data: {...state.data, attempts: [...state.data.attempts, entry]},
  };
  changed();
}

export function buildExport(data: ActivityData, language: string) {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedWeek: isoWeek(),
    language,
    ...data,
  };
}
