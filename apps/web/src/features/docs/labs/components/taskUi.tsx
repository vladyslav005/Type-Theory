import {useState, type ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Check, X} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {termLabel} from "@/features/docs/labs/components/nblTermLabel.ts";
import type {Verdict} from "@/features/docs/labs/components/taskStyles.ts";
import {trackReveal} from "@/shared/activity/taskTracking.ts";

export function Feedback({verdict}: {verdict: Verdict}) {
  if (!verdict) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs", verdict.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
      {verdict.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0"/> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0"/>}
      {verdict.text}
    </p>
  );
}

export function Row({index, source, children, solution, taskId}: {index: number; source?: string; children: ReactNode; solution?: ReactNode; taskId?: string}) {
  const {t} = useTranslation();
  const [shown, setShown] = useState(false);
  return (
    <li className="space-y-2 rounded-lg border bg-muted/10 p-3">
      {source !== undefined && (
        <div className="flex gap-3 font-mono text-sm">
          <span className="w-6 shrink-0 text-muted-foreground">{termLabel(index)}</span>
          <span className="min-w-0 break-words">{source}</span>
        </div>
      )}
      <div className={cn("space-y-2", source !== undefined && "pl-9")}>
        {children}
        {solution !== undefined && (
          <>
            <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { if (!shown) trackReveal(taskId); setShown(!shown); }}>
              {shown ? t("labWidgets.hideSolution") : t("labWidgets.showSolution")}
            </button>
            {shown && <div className="rounded-md border border-dashed bg-background p-2.5 text-xs">{solution}</div>}
          </>
        )}
      </div>
    </li>
  );
}
