import {createContext, useContext, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {Check, ChevronUp, Play, X} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {termLabel} from "@/features/docs/labs/components/nblTermLabel.ts";
import type {Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {trackReveal} from "@/shared/activity/taskTracking.ts";
import {getSavedWork, useSavedState} from "@/shared/activity/savedWork.ts";
import {Button} from "@/shared/components/ui/button.tsx";

export function Feedback({verdict}: {verdict: Verdict}) {
  if (!verdict) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", verdict.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
      {verdict.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0"/> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0"/>}
      {verdict.text}
    </p>
  );
}

// Where a row's term line keeps room on the right for the editor's Start/Hide button.
const RowActionSlot = createContext<HTMLElement | null>(null);

export function Row({index, source, children, solution, taskId}: {index: number; source?: string; children: ReactNode; solution?: ReactNode; taskId?: string}) {
  const {t} = useTranslation();
  const [shown, setShown] = useState(false);
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  return (
    <RowActionSlot.Provider value={actionSlot}>
    <li className="space-y-2 rounded-lg border bg-muted/10 p-3">
      {source !== undefined && (
        <div className="flex items-start gap-3 font-mono text-sm">
          <span className="w-6 shrink-0 text-muted-foreground">{termLabel(index)}</span>
          <span className="min-w-0 flex-1 break-words">{source}</span>
          <div ref={setActionSlot} className="shrink-0 font-sans empty:hidden"/>
        </div>
      )}
      <div className={cn("space-y-2", source !== undefined && "pl-9")}>
        {children}
        {solution !== undefined && (
          <>
            <div>
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { if (!shown) trackReveal(taskId); setShown(!shown); }}>
                {shown ? t("labWidgets.hideSolution") : t("labWidgets.showSolution")}
              </button>
            </div>
            {shown && <div className="rounded-md border border-dashed bg-background p-2.5 text-xs">{solution}</div>}
          </>
        )}
      </div>
    </li>
    </RowActionSlot.Provider>
  );
}

// Untouched editors save empty state too (a blank answer, an empty tree) — that isn't work to resume.
function hasWork(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false || value === 0) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "object") return true;
  const graph = (value as {graph?: {nodes?: {type?: string}[]}}).graph;
  if (graph) return (graph.nodes ?? []).some((node) => node.type !== "program");
  return Object.keys(value).length > 0;
}

// Editors stay collapsed until the student starts; a task already worked on opens by itself.
// The Start/Hide toggle sits at the right of the row's term line when there is one.
export function SolveArea({taskId, children}: {taskId?: string; children: ReactNode}) {
  const {t} = useTranslation();
  const slot = useContext(RowActionSlot);
  const [open, setOpen] = useSavedState(taskId && `${taskId}#open`, () =>
    !!taskId && Object.entries(getSavedWork()).some(([key, value]) => key.startsWith(`${taskId}#`) && !key.endsWith("#open") && hasWork(value)));

  const toggle = open ? (
    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => setOpen(false)}>
      <ChevronUp className="h-3.5 w-3.5"/>
      {t("labWidgets.hideEditor")}
    </Button>
  ) : (
    <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => setOpen(true)}>
      <Play className="h-3.5 w-3.5"/>
      {t("labWidgets.startSolving")}
    </Button>
  );

  if (slot) return <>{createPortal(toggle, slot)}{open && <div className="space-y-2">{children}</div>}</>;
  return (
    <div className="space-y-2">
      <div>{toggle}</div>
      {open && children}
    </div>
  );
}
