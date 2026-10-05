import {version as appVersion} from "../../../package.json";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";

const STORAGE_KEY = "tt.activity.v1";
const SCHEMA_VERSION = 2;
const MAX_ATTEMPTS = 20000;

export type Consent = "granted" | "denied";

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
  sessions: number;
}

// sec = seconds since this task's first recorded event; at = local date and time of the attempt.
export interface Attempt {
  task: string;
  week: string;
  sec: number;
  at: string;
  ok?: boolean;
  kind?: string;
  score?: string;
  reveal?: true;
}

// Session starts and page visits, each with its local date and time.
export interface ActivityEvent {
  at: string;
  type: "session" | "page";
  detail: string;
}

// One practice run in the editor (not a lab task): the term practised, when, for how long, and how it went.
export interface PracticeSession {
  id: string;
  mode: "evaluation" | "proofSemi" | "proofManual" | "syntaxDerivation";
  term: string;
  strategy?: string;
  startedAt: string;
  seconds: number;
  steps?: number;
  checks: number;
  finished?: boolean;
  allCorrect?: boolean;
}

export interface ActivityData {
  weeks: Record<string, WeekStats>;
  attempts: Attempt[];
  events: ActivityEvent[];
  // Active seconds per lab/lecture task id.
  taskSeconds: Record<string, number>;
  practice: PracticeSession[];
  // Totals imported from other browsers, one part per source, replaced (not added) on re-import.
  parts?: Record<string, SourcePart>;
  truncated?: true;
}

export interface SourcePart {
  weeks: Record<string, WeekStats>;
  taskSeconds: Record<string, number>;
}

interface StoredActivity {
  consent: Consent;
  data: ActivityData;
  // Random id of this browser's data, so its totals merge correctly when imported elsewhere.
  origin: string;
  // Local bookkeeping only, stripped from the export.
  taskFirstSeen: Record<string, number>;
  failureStreak: number;
}

const emptyData = (): ActivityData => ({weeks: {}, attempts: [], events: [], taskSeconds: {}, practice: []});

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
  sessions: 0,
});

export function isoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Local date and time with the UTC offset, e.g. 2026-10-03T14:05:12+02:00.
export function localTimestamp(date = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${offset >= 0 ? "+" : "-"}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
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

function load(raw = readStorage()): StoredActivity {
  const fallback: StoredActivity = {consent: "granted", data: emptyData(), origin: crypto.randomUUID(), taskFirstSeen: {}, failureStreak: 0};
  try {
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredActivity>;
    return {
      consent: parsed.consent === "denied" ? "denied" : "granted",
      data: parsed.data && typeof parsed.data === "object" ? {...emptyData(), ...parsed.data} : emptyData(),
      origin: typeof parsed.origin === "string" ? parsed.origin : crypto.randomUUID(),
      taskFirstSeen: parsed.taskFirstSeen ?? {},
      failureStreak: typeof parsed.failureStreak === "number" ? parsed.failureStreak : 0,
    };
  } catch {
    return fallback;
  }
}

function readStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let lastRaw = readStorage();
let state = load(lastRaw);
let snapshot = {consent: state.consent, data: state.data};
const listeners = new Set<() => void>();

const notify = () => {
  snapshot = {consent: state.consent, data: state.data};
  listeners.forEach((listener) => listener());
};

// Picks up what other open tabs saved, so every change builds on the latest stored data.
function sync() {
  const raw = readStorage();
  if (raw === null || raw === lastRaw) return false;
  lastRaw = raw;
  state = load(raw);
  return true;
}

// Saved on every change (never delayed), so another open tab never overwrites unsaved records.
function changed() {
  notify();
  try {
    lastRaw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, lastRaw);
  } catch {
    // Storage full or unavailable — stats just won't persist.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if ((event.key === STORAGE_KEY || event.key === null) && sync()) notify();
  });
}

export const isCollecting = () => {
  sync();
  return STUDY_MODE && state.consent === "granted";
};

export function subscribeActivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getActivitySnapshot = () => snapshot;

export function setConsent(consent: Consent) {
  sync();
  state = {...state, consent};
  changed();
}

export function deleteActivityData() {
  sync();
  state = {...state, data: emptyData(), taskFirstSeen: {}, failureStreak: 0};
  changed();
}

// Mutates a fresh copy so the snapshot handed to React always changes identity.
export function recordWeek(update: (week: WeekStats, internal: {failureStreak: number}) => void) {
  if (!isCollecting()) return;
  const key = isoWeek();
  const week = withDefaults(emptyWeek(), structuredClone(state.data.weeks[key]));
  // Weeks stored before sessions became a single count kept a mobile/desktop split.
  const storedSessions = week.sessions as unknown;
  if (typeof storedSessions === "object" && storedSessions !== null) {
    week.sessions = Object.values(storedSessions as Record<string, number>).reduce((sum, n) => sum + (n || 0), 0);
  }
  const internal = {failureStreak: state.failureStreak};
  update(week, internal);
  state = {...state, failureStreak: internal.failureStreak, data: {...state.data, weeks: {...state.data.weeks, [key]: week}}};
  changed();
}

export function addTaskSeconds(task: string, seconds: number) {
  if (!isCollecting()) return;
  state = {...state, data: {...state.data, taskSeconds: {...state.data.taskSeconds, [task]: (state.data.taskSeconds[task] ?? 0) + seconds}}};
  changed();
}

export function startPracticeSession(session: Omit<PracticeSession, "id" | "startedAt" | "seconds" | "checks">): string | undefined {
  if (!isCollecting() || state.data.practice.length >= MAX_ATTEMPTS) return undefined;
  const entry: PracticeSession = {id: crypto.randomUUID(), startedAt: localTimestamp(), seconds: 0, checks: 0, ...session};
  state = {...state, data: {...state.data, practice: [...state.data.practice, entry]}};
  changed();
  return entry.id;
}

export function updatePracticeSession(id: string | undefined, update: (session: PracticeSession) => PracticeSession) {
  if (!id || !isCollecting()) return;
  state = {...state, data: {...state.data, practice: state.data.practice.map((session) => (session.id === id ? update(session) : session))}};
  changed();
}

export function recordEvent(type: ActivityEvent["type"], detail: string) {
  if (!isCollecting() || state.data.events.length >= MAX_ATTEMPTS) return;
  state = {...state, data: {...state.data, events: [...state.data.events, {at: localTimestamp(), type, detail}]}};
  changed();
}

export function recordAttempt(attempt: Omit<Attempt, "week" | "sec" | "at">) {
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
  const entry: Attempt = {...attempt, week: isoWeek(), sec: Math.round((now - firstSeen) / 1000), at: localTimestamp(new Date(now))};
  state = {
    ...state,
    taskFirstSeen: {...state.taskFirstSeen, [attempt.task]: firstSeen},
    data: {...state.data, attempts: [...state.data.attempts, entry]},
  };
  changed();
}

// Adds numeric leaves of two counter objects (weeks, seconds) key by key.
function sumCounters<T>(a: T, b: T): T {
  if (typeof a === "number" || typeof b === "number") return ((Number(a) || 0) + (Number(b) || 0)) as T;
  if (typeof a !== "object" || a === null) return b;
  if (typeof b !== "object" || b === null) return a;
  const result: Record<string, unknown> = {...(a as Record<string, unknown>)};
  for (const [key, value] of Object.entries(b as Record<string, unknown>)) result[key] = key in result ? sumCounters(result[key], value) : value;
  return result as T;
}

// This browser's totals plus every imported source's — what the page shows and the export carries.
export function combinedTotals(data: ActivityData): SourcePart {
  return Object.values(data.parts ?? {}).reduce<SourcePart>(
    (total, part) => ({weeks: sumCounters(total.weeks, part.weeks ?? {}), taskSeconds: sumCounters(total.taskSeconds, part.taskSeconds ?? {})}),
    {weeks: data.weeks, taskSeconds: data.taskSeconds},
  );
}

const unique = <T,>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export type ImportResult = {ok: true; attempts: number; events: number; practice: number} | {ok: false; reason: "invalid" | "own" | "notCollecting"};

// Merges a downloaded file from another browser: logs are de-duplicated, totals stored per source.
export function importActivity(file: unknown): ImportResult {
  if (!isCollecting()) return {ok: false, reason: "notCollecting"};
  const incoming = file as Partial<ReturnType<typeof buildExport>>;
  if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.attempts) || typeof incoming.weeks !== "object") return {ok: false, reason: "invalid"};
  if (incoming.origin === state.origin) return {ok: false, reason: "own"};

  const fallbackOrigin = `import-${incoming.exportedAt ?? incoming.exportedWeek ?? "unknown"}`;
  const incomingParts: Record<string, SourcePart> = incoming.parts && typeof incoming.parts === "object"
    ? incoming.parts as Record<string, SourcePart>
    : {[incoming.origin ?? fallbackOrigin]: {weeks: incoming.weeks ?? {}, taskSeconds: incoming.taskSeconds ?? {}}};
  const parts = {...state.data.parts};
  for (const [origin, part] of Object.entries(incomingParts)) if (origin !== state.origin) parts[origin] = part;

  const attempts = unique([...state.data.attempts, ...incoming.attempts], (a) => JSON.stringify([a.task, a.at, a.sec, a.ok, a.kind, a.reveal]));
  const events = unique([...state.data.events, ...(incoming.events ?? [])], (e) => `${e.at}|${e.type}|${e.detail}`);
  const practice = unique([...state.data.practice, ...(incoming.practice ?? [])], (p) => p.id);
  const added = {
    attempts: attempts.length - state.data.attempts.length,
    events: events.length - state.data.events.length,
    practice: practice.length - state.data.practice.length,
  };
  state = {...state, data: {...state.data, attempts, events, practice, parts}};
  changed();
  return {ok: true, ...added};
}

// Practice steps and hint checks are activity, not answers — they never mark a task solved.
export const isWorkingStep = (attempt: Attempt) => attempt.kind === "step" || attempt.kind === "wrongStep" || !!attempt.kind?.startsWith("check:");
export const isAnswer = (attempt: Attempt) => !attempt.reveal && !isWorkingStep(attempt);

export interface TaskProgress {
  seconds: number;
  attempts: number;
  solved: boolean;
  reveals: number;
  firstAt: string;
  lastAt: string;
}

// Per lab (or lecture) scope, per task: how far the student got, derived from the attempt log.
export function taskProgress(attempts: Attempt[], taskSeconds: Record<string, number> = {}): Record<string, Record<string, TaskProgress>> {
  const progress: Record<string, Record<string, TaskProgress>> = {};
  for (const attempt of attempts) {
    const [scope, ...rest] = attempt.task.split("/");
    const task = rest.join("/");
    const entry = (progress[scope] ??= {})[task] ??= {seconds: taskSeconds[attempt.task] ?? 0, attempts: 0, solved: false, reveals: 0, firstAt: attempt.at, lastAt: attempt.at};
    if (attempt.reveal) entry.reveals += 1;
    else if (isAnswer(attempt)) entry.attempts += 1;
    if (attempt.ok && isAnswer(attempt)) entry.solved = true;
    entry.lastAt = attempt.at ?? entry.lastAt;
  }
  return progress;
}

export function buildExport(data: ActivityData, language: string, work: Record<string, unknown> = {}) {
  const totals = combinedTotals(data);
  const {parts, weeks, taskSeconds, ...logs} = data;
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion,
    exportedAt: localTimestamp(),
    exportedWeek: isoWeek(),
    language,
    origin: state.origin,
    progress: taskProgress(data.attempts, totals.taskSeconds),
    work,
    ...logs,
    // Combined over every source, so the file reads as one student's whole record.
    weeks: totals.weeks,
    taskSeconds: totals.taskSeconds,
    // Each source's own totals, so importing this file elsewhere never counts anything twice.
    parts: {...parts, [state.origin]: {weeks, taskSeconds}},
  };
}
