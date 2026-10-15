import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject} from "react";
import {createPortal} from "react-dom";
import {useStore} from "react-redux";
import {useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {CheckCircle2, ChevronUp, GripHorizontal, Info, Minus, PanelTop, X} from "lucide-react";
import {TYPE_THEORIES, type TypeTheoryId} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button";
import {cn} from "@/shared/lib/utils";
import type {RootState} from "@/app/providers/store.ts";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {useAppDispatch} from "@/shared/hooks/reduxHooks.ts";
import {
  exitBuildMode,
  setCurryHoward,
  setEvaluationStrategy,
  setTermText,
  setTheoryEnabled,
} from "@/shared/ui-state/termSlice.ts";
import type {WorkspacePanelId} from "@/shared/ui-state/outputPanel.ts";
import {endTour, startTour, useActiveTour} from "@/features/tour/tourStore.ts";
import {onTourSignal, type TourSignal} from "@/features/tour/tourSignals.ts";
import {TOURS, type Tour as TourDefinition} from "@/features/tour/tours.ts";
import {LearnLinks} from "@/features/tour/LearnLinks.tsx";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Measured {
  step: number;
  // First entry is the step's target; the rest are areas the step also refers to.
  holes: Box[];
  ring: Box | null;
  editor: Box | null;
  card: {width: number; height: number};
  needsTab: boolean;
  done: boolean;
}

// Something the tutorial changed by itself, listed on the card so nothing happens unexplained.
interface Note {
  text: string;
  code?: string;
}

const PAD = 6;
const GAP = 12;
const MARGIN = 16;
// Keeps the card clear of the sticky top bar.
const TOP_MARGIN = 72;
const TARGET_TIMEOUT_MS = 1500;
const HIGHLIGHT_MS = 4000;
const EXCLUSIVE_THEORY_IDS: TypeTheoryId[] = ["untyped", "nbl", "typedNbl"];

const PANEL_TITLE_KEYS: Record<WorkspacePanelId, string> = {
  editor: "panels.editor",
  errorOutput: "panels.errors",
  evaluation: "panels.evaluation",
  proofTree: "panels.proofTree",
  ast: "panels.ast",
};

function findTarget(token: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour~="${token}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function boxAround(...els: (HTMLElement | null)[]): Box | null {
  const rects = els.filter((el): el is HTMLElement => !!el).map((el) => el.getBoundingClientRect());
  if (rects.length === 0) return null;
  const top = Math.max(Math.min(...rects.map((r) => r.top)) - PAD, 0);
  const left = Math.max(Math.min(...rects.map((r) => r.left)) - PAD, 0);
  const bottom = Math.min(Math.max(...rects.map((r) => r.bottom)) + PAD, window.innerHeight);
  const right = Math.min(Math.max(...rects.map((r) => r.right)) + PAD, window.innerWidth);
  return {top: Math.round(top), left: Math.round(left), width: Math.round(right - left), height: Math.round(bottom - top)};
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

const sameMeasure = (a: Measured, b: Measured) =>
  a.step === b.step && a.needsTab === b.needsTab && a.done === b.done
  && a.holes.length === b.holes.length && a.holes.every((h, i) => sameBox(h, b.holes[i]))
  && sameBox(a.ring, b.ring) && sameBox(a.editor, b.editor)
  && a.card.width === b.card.width && a.card.height === b.card.height;

function overlap(a: Box, b: Box) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

// Tries spots around the target and in the screen corners and takes the one covering the least of
// what matters: the control to use, the code in the editor, then the highlighted areas.
function placeCard(m: Measured) {
  const {width, height} = m.card;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampLeft = (x: number) => Math.min(Math.max(x, MARGIN), vw - width - MARGIN);
  const clampTop = (y: number) => Math.min(Math.max(y, TOP_MARGIN), vh - height - MARGIN);
  const spot = (left: number, top: number): Box => ({left: clampLeft(left), top: clampTop(top), width, height});
  const main = m.holes[0];
  if (!main) return spot((vw - width) / 2, (vh - height) / 2);

  const centerX = main.left + main.width / 2 - width / 2;
  const centerY = main.top + main.height / 2 - height / 2;
  const candidates = [
    spot(centerX, main.top + main.height + GAP),
    spot(centerX, main.top - GAP - height),
    spot(main.left + main.width + GAP, centerY),
    spot(main.left - GAP - width, centerY),
    spot(vw - width - MARGIN, vh - height - MARGIN),
    spot(MARGIN, vh - height - MARGIN),
    spot(vw - width - MARGIN, TOP_MARGIN),
    spot(MARGIN, TOP_MARGIN),
    spot(main.left + main.width - width - GAP, main.top + main.height - height - GAP),
  ];
  // Code starts at the top of the editor, so its upper part counts most.
  const code = m.editor ? {...m.editor, height: Math.round(m.editor.height * 0.45)} : null;
  const cost = (c: Box) =>
    (m.ring ? overlap(c, m.ring) * 10 : 0)
    + (code ? overlap(c, code) * 6 : 0)
    + overlap(c, main)
    + m.holes.slice(1).reduce((sum, h) => sum + overlap(c, h) * 3, 0);
  return candidates.reduce((best, c) => (cost(c) < cost(best) ? c : best));
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function roundedRect({left: x, top: y, width: w, height: h}: Box, r = 8) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function highlightSnippet(editor: TextEditorHandle | null, snippet: string) {
  if (!editor) return;
  const text = editor.getValue();
  const start = text.lastIndexOf(snippet);
  if (start < 0) return;
  const before = text.slice(0, start).split("\n");
  const lines = snippet.split("\n");
  const line = before.length;
  const column = before[before.length - 1].length;
  const endLine = line + lines.length - 1;
  const endColumn = lines.length === 1 ? column + snippet.length : lines[lines.length - 1].length;
  editor.highlightRange({line, column, length: snippet.length, endLine, endColumn});
}

// Translation markup: `code`, **a label as it appears on screen**, [[a keyboard key]].
const MARKUP = /(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/;

function RichText({text}: {text: string}) {
  return (
    <>
      {text.split("\n\n").map((paragraph, i) => (
        <p key={i}>
          {paragraph.split(MARKUP).map((part, j) => {
            if (part.startsWith("`")) {
              return <code key={j} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8rem] text-foreground">{part.slice(1, -1)}</code>;
            }
            if (part.startsWith("**")) {
              return <span key={j} className="box-decoration-clone rounded border bg-background px-1 py-px text-[0.8rem] font-semibold text-foreground shadow-xs">{part.slice(2, -2)}</span>;
            }
            if (part.startsWith("[[")) {
              return <kbd key={j} className="rounded border border-b-2 bg-muted px-1 font-mono text-[0.75rem] text-foreground">{part.slice(2, -2)}</kbd>;
            }
            return part;
          })}
        </p>
      ))}
    </>
  );
}

export function TourOverlay({editorRef}: {editorRef: RefObject<TextEditorHandle | null>}) {
  const active = useActiveTour();
  if (!active) return null;
  return createPortal(<Tour key={active} tour={TOURS[active]} editorRef={editorRef}/>, document.body);
}

function Tour({tour, editorRef}: {tour: TourDefinition; editorRef: RefObject<TextEditorHandle | null>}) {
  const {t} = useTranslation();
  const {pathname} = useLocation();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [notes, setNotes] = useState<{step: number; items: Note[]}>({step: 0, items: []});
  const [drag, setDrag] = useState<{step: number; dx: number; dy: number} | null>(null);
  const [minimized, setMinimized] = useState<number | null>(null);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  const steps = tour.steps;
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const onEditor = pathname === "/main";
  const interactive = !!step.task;

  const addNote = (note: Note, forStep = index) =>
    setNotes((prev) => ({step: forStep, items: prev.step === forStep ? [...prev.items, note] : [note]}));

  // Interactive tours borrow the editor and settings; everything the user had comes back when the tour ends.
  useEffect(() => {
    if (tour.code === undefined) return;
    const saved = store.getState().term;
    const changed: Note[] = [];
    const write = (text: string) => {
      editorRef.current?.setValue(text);
      dispatch(setTermText(text));
    };

    // The base language is the user's own step; only extensions they may not know about are switched off.
    const turnedOff = TYPE_THEORIES.filter((theory) => !EXCLUSIVE_THEORY_IDS.includes(theory.id) && saved.enabledTheories[theory.id]);
    turnedOff.forEach((theory) => dispatch(setTheoryEnabled({id: theory.id, enabled: false})));
    if (saved.curryHoward) dispatch(setCurryHoward(false));
    const offLabels = [
      ...turnedOff.map((theory) => t(`extensions.theories.${theory.id}.label`, theory.label)),
      ...(saved.curryHoward ? [t("extensions.curryHoward.label")] : []),
    ];
    if (offLabels.length > 0) changed.push({text: t("tour.notes.settingsReset", {list: offLabels.join(", ")})});
    if (tour.strategy && tour.strategy !== saved.evaluationStrategy) {
      dispatch(setEvaluationStrategy(tour.strategy));
      changed.push({text: t("tour.notes.strategy", {strategy: t(`evalStrategy.${tour.strategy}.label`)})});
    }
    if (saved.buildMode.active) dispatch(exitBuildMode());
    write(tour.code);
    changed.push({text: t("tour.notes.code"), code: tour.code.trim() || undefined});
    const frame = requestAnimationFrame(() => setNotes({step: 0, items: changed}));

    return () => {
      cancelAnimationFrame(frame);
      const now = store.getState().term;
      if (now.buildMode.active) dispatch(exitBuildMode());
      write(saved.termText ?? "");
      EXCLUSIVE_THEORY_IDS.forEach((id) => now.enabledTheories[id] && dispatch(setTheoryEnabled({id, enabled: false})));
      EXCLUSIVE_THEORY_IDS.forEach((id) => saved.enabledTheories[id] && dispatch(setTheoryEnabled({id, enabled: true})));
      TYPE_THEORIES.filter((theory) => !EXCLUSIVE_THEORY_IDS.includes(theory.id)).forEach((theory) => {
        if (store.getState().term.enabledTheories[theory.id] !== saved.enabledTheories[theory.id]) {
          dispatch(setTheoryEnabled({id: theory.id, enabled: saved.enabledTheories[theory.id]}));
        }
      });
      if (now.curryHoward !== saved.curryHoward) dispatch(setCurryHoward(saved.curryHoward));
      if (now.evaluationStrategy !== saved.evaluationStrategy) dispatch(setEvaluationStrategy(saved.evaluationStrategy));
    };
  }, [tour, store, dispatch, editorRef, t]);

  // Leaving the editor mid-tour (e.g. following the Learn link) ends it.
  useEffect(() => {
    if (previousPath.current === "/main" && pathname !== "/main") endTour();
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const {target, panel, pointAt, task, alsoShow = [], highlight} = step;
    if (target && !onEditor) return;
    const startedAt = performance.now();
    const initial = store.getState();
    const signals: TourSignal[] = [];
    const unsubscribe = onTourSignal((signal) => signals.push(signal));
    let done = false;
    let scrolled = false;
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const showsEditor = target === "panel-editor" || alsoShow.includes("panel-editor") || !!step.code;
    const clearHighlight = () => editorRef.current?.highlightRange(null);

    let highlighted = false;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      // A panel in a background tab waits for the user to open it; the tutorial never switches tabs itself.
      const tabEl = panel ? findTarget(`tab-${panel}`) : null;
      const needsTab = !!panel && !!tabEl && !findTarget(`panel-${panel}`);
      // The tab is only part of the highlight when the step is about the whole panel.
      const tab = needsTab || target === `panel-${panel}` ? tabEl : null;
      const el = needsTab ? null : target ? findTarget(target) : null;
      if (!needsTab && target && !el && performance.now() - startedAt < TARGET_TIMEOUT_MS) return;
      if (!needsTab && target && !el && step.skipIfMissing) {
        cancelAnimationFrame(frame);
        setIndex((i) => Math.min(Math.max(i + direction.current, 0), steps.length - 1));
        return;
      }
      if (el && !scrolled) {
        el.scrollIntoView({block: "nearest", inline: "nearest"});
        scrolled = true;
      }
      if (!needsTab && highlight && !highlighted) {
        highlighted = true;
        timers.push(setTimeout(() => highlightSnippet(editorRef.current, highlight), 300));
      }
      if (!needsTab) done ||= !task || task({state: store.getState(), initial, signals});
      const main = needsTab ? boxAround(tab) : el ? boxAround(el, tab) : null;
      const extra = needsTab ? [] : [...alsoShow, ...(showsEditor && target !== "panel-editor" ? ["panel-editor"] : [])]
        .filter((token, i, all) => all.indexOf(token) === i)
        .map((token) => boxAround(findTarget(token)))
        .filter((box): box is Box => !!box && !sameBox(box, main));
      const pointEl = pointAt && !needsTab ? findTarget(pointAt) : null;
      const editorEl = showsEditor && !needsTab ? findTarget("panel-editor") : null;
      const next: Measured = {
        step: index,
        holes: main ? [main, ...extra] : extra,
        ring: boxAround(pointEl ?? tab),
        editor: boxAround(editorEl),
        card: {width: cardRef.current?.offsetWidth ?? 0, height: cardRef.current?.offsetHeight ?? 0},
        needsTab,
        done,
      };
      setMeasured((prev) => (prev && sameMeasure(prev, next) ? prev : next));
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      unsubscribe();
      if (highlight) clearHighlight();
    };
  }, [index, step, steps, onEditor, store, editorRef]);

  const ready = measured?.step === index;
  const done = ready && measured.done;
  const needsTab = ready && measured.needsTab;
  const holes = ready ? measured.holes : [];
  const ring = ready ? measured.ring : null;
  const stepNotes = notes.step === index ? notes.items : [];
  const isMinimized = minimized === index;

  const go = (delta: 1 | -1) => {
    direction.current = delta;
    if (delta === 1 && isLast) endTour();
    else setIndex((i) => Math.min(Math.max(i + delta, 0), steps.length - 1));
  };

  const continueWith = (id: NonNullable<TourDefinition["next"]>) => {
    endTour();
    startTour(id);
  };

  const doItForMe = () => {
    const code = step.code!;
    const current = editorRef.current?.getValue() ?? store.getState().term.termText ?? "";
    const text = step.append ? `${current.replace(/\s*$/, "")}\n${code}\n` : code;
    editorRef.current?.setValue(text);
    dispatch(setTermText(text));
    addNote({text: t(step.append ? "tour.notes.appended" : "tour.notes.typed"), code});
    const snippet = step.append ? code : code.split("\n").filter((line) => !line.startsWith("//")).join("\n");
    setTimeout(() => highlightSnippet(editorRef.current, snippet), 50);
    setTimeout(() => editorRef.current?.highlightRange(null), HIGHLIGHT_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === "Escape") endTour();
      else if (e.key === "ArrowRight" && done) go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Interactive steps leave focus where the user is working.
  useEffect(() => {
    if (ready && !interactive) nextRef.current?.focus({preventScroll: true});
  }, [ready, index, interactive]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const base = drag?.step === index ? drag : {step: index, dx: 0, dy: 0};
    const move = (ev: PointerEvent) => setDrag({step: index, dx: base.dx + ev.clientX - startX, dy: base.dy + ev.clientY - startY});
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const placed = ready && measured.card.width > 0 ? placeCard(measured) : null;
  const dragged = drag?.step === index ? drag : null;
  const position = placed ? {left: placed.left + (dragged?.dx ?? 0), top: placed.top + (dragged?.dy ?? 0)} : null;
  const stepKey = step.shared ? `tour.shared.${step.shared}` : `tour.steps.${tour.id}.${step.id}`;
  // Waiting for a tab click counts as interactive: on phones the panel is picked from a dropdown, which must stay usable.
  const dimmed = !interactive && !needsTab;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return (
    <>
      {/* Interactive steps sit under menus and the top bar so dropdowns opened during a step stay usable. */}
      <svg className={cn("pointer-events-none fixed inset-0 h-full w-full", dimmed ? "z-[200]" : "z-[45]")} width={vw} height={vh}>
        <path
          d={`M0 0H${vw}V${vh}H0Z${holes.map((h) => roundedRect(h)).join("")}`}
          fillRule="evenodd"
          className={cn("transition-[fill] duration-300", dimmed ? "pointer-events-auto fill-black/55" : "fill-black/25")}
        />
      </svg>

      <div className={cn("pointer-events-none fixed inset-0", dimmed ? "z-[201]" : "z-[60]")}>
        {holes.map((h, i) => (
          <div
            key={i}
            className={cn("fixed rounded-lg transition-all duration-300 ease-out", i === 0 ? "ring-2 ring-primary" : "ring-2 ring-primary/40")}
            style={{...h}}
          />
        ))}
        {ring && !holes.some((h) => sameBox(h, ring)) && (
          <div className="fixed rounded-md ring-[3px] ring-primary animate-pulse transition-all duration-300 ease-out" style={{...ring}}/>
        )}
      </div>

      <div className={cn("pointer-events-none fixed inset-0", dimmed ? "z-[202]" : "z-[46]")}>
        {isMinimized ? (
          <Button size="sm" className="pointer-events-auto fixed bottom-4 right-4 gap-1.5 shadow-2xl" onClick={() => setMinimized(null)}>
            <ChevronUp className="h-4 w-4"/>
            {t("tour.restore", {current: index + 1, total: steps.length})}
            {interactive && done && <CheckCircle2 className="h-4 w-4"/>}
          </Button>
        ) : (
          <div
            ref={cardRef}
            role="dialog"
            aria-modal={dimmed}
            aria-labelledby="tour-title"
            className={cn(
              "pointer-events-auto fixed w-[min(24rem,calc(100vw-2rem))] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl",
              !dragged && "transition-[top,left,opacity] duration-300 ease-out",
              !position && "opacity-0",
            )}
            style={position ?? {top: 0, left: 0}}
          >
            <div className="-mx-4 -mt-4 mb-2 flex cursor-grab touch-none items-center gap-2 px-4 pt-2 active:cursor-grabbing" onPointerDown={startDrag} title={t("tour.drag")}>
              <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/60"/>
              {step.panel && (
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  needsTab ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  <PanelTop className="h-3 w-3"/>
                  {t("tour.inTab", {panel: t(PANEL_TITLE_KEYS[step.panel])})}
                </span>
              )}
              <span className="ml-auto flex items-center">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setMinimized(index)} aria-label={t("tour.minimize")} title={t("tour.minimize")}>
                  <Minus className="h-4 w-4"/>
                </Button>
                <Button variant="ghost" size="icon" className="-mr-2 size-7" onClick={endTour} aria-label={t("tour.skip")} title={t("tour.skip")}>
                  <X className="h-4 w-4"/>
                </Button>
              </span>
            </div>

            <h2 id="tour-title" className="mb-2 text-base font-semibold leading-snug">{t(`${stepKey}.title`)}</h2>
            {needsTab && step.panel ? (
              <div className="flex items-start gap-2 rounded-lg border border-primary/50 bg-primary/5 px-2.5 py-2 text-sm">
                <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-primary"/>
                <RichText text={t("tour.openTab", {panel: t(PANEL_TITLE_KEYS[step.panel])})}/>
              </div>
            ) : (
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <RichText text={t(`${stepKey}.body`)}/>
              </div>
            )}

            {stepNotes.length > 0 && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-sky-500/30 bg-sky-500/5 px-2.5 py-2 text-xs text-sky-800 dark:text-sky-200">
                <p className="flex items-center gap-1.5 font-medium"><Info className="h-3.5 w-3.5"/>{t("tour.notes.heading")}</p>
                {stepNotes.map((note, i) => (
                  <div key={i}>
                    <p>{note.text}</p>
                    {note.code && <pre className="mt-1 overflow-x-auto rounded bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground">{note.code}</pre>}
                  </div>
                ))}
              </div>
            )}

            {step.learn && !needsTab ? (
              <LearnLinks links={step.learn} heading={t("tour.learn.step")}/>
            ) : tour.learn && (index === 0 || isLast) && (
              <LearnLinks links={tour.learn} heading={t(index === 0 ? "tour.learn.before" : "tour.learn.after")}/>
            )}

            {interactive && !needsTab && (
              <div className={cn(
                "mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                done ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-dashed text-muted-foreground",
              )}>
                {done
                  ? <><CheckCircle2 className="h-4 w-4 shrink-0"/>{t("tour.taskDone")}</>
                  : <><span className="size-2 shrink-0 animate-pulse rounded-full bg-primary"/>{t("tour.taskTodo")}</>}
                {!done && step.code && (
                  <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={doItForMe}>
                    {t("tour.doItForMe")}
                  </Button>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-auto text-xs tabular-nums text-muted-foreground">
                {t("tour.progress", {current: index + 1, total: steps.length})}
              </span>
              {(interactive || needsTab) && !done && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => go(1)}>{t("tour.skipStep")}</Button>
              )}
              {index > 0 && <Button variant="outline" size="sm" onClick={() => go(-1)}>{t("tour.back")}</Button>}
              {isLast && tour.next ? (
                <>
                  <Button variant="outline" size="sm" onClick={endTour}>{t("tour.done")}</Button>
                  <Button ref={nextRef} size="sm" onClick={() => continueWith(tour.next!)}>
                    {t("tour.continueWith", {title: t(`tour.tours.${tour.next}.short`)})}
                  </Button>
                </>
              ) : (
                <Button ref={nextRef} size="sm" disabled={!done} onClick={() => go(1)}>{isLast ? t("tour.done") : t("tour.next")}</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
