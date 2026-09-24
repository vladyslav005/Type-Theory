import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {BarChart3, Check, Download, Trash2, X} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/shared/components/ui/dialog.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";
import {downloadTextFile} from "@/shared/lib/downloadTextFile.ts";
import {buildExport, deleteActivityData, setConsent, type ActivityData} from "@/shared/activity/activityStore.ts";
import {useActivity} from "@/shared/activity/useActivity.ts";
import {LAB_REGISTRY, getLabText} from "@/features/docs/labs/labRegistry.ts";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";

interface ScopeProgress {
  scope: string;
  solved: number;
  attempted: number;
}

function summarize(data: ActivityData) {
  const weeks = Object.values(data.weeks);
  const activeSeconds = weeks.reduce((sum, week) => sum + week.activeSeconds, 0);
  const weeksActive = weeks.filter((week) => week.activeSeconds > 0).length;

  const attempted = new Set<string>();
  const solved = new Set<string>();
  data.attempts.forEach((attempt) => {
    if (attempt.reveal || attempt.task.endsWith("/steps")) return;
    attempted.add(attempt.task);
    if (attempt.ok && attempt.kind !== "step") solved.add(attempt.task);
  });

  const byScope = new Map<string, ScopeProgress>();
  attempted.forEach((task) => {
    const scope = task.split("/")[0];
    const entry = byScope.get(scope) ?? {scope, solved: 0, attempted: 0};
    entry.attempted++;
    if (solved.has(task)) entry.solved++;
    byScope.set(scope, entry);
  });

  return {activeSeconds, weeksActive, attempted: attempted.size, solved: solved.size, scopes: [...byScope.values()]};
}

function Stat({value, label}: {value: string; label: string}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function ActivityPage() {
  const {t, i18n} = useTranslation();
  const {consent, data} = useActivity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const collecting = consent === "granted";
  const summary = useMemo(() => summarize(data), [data]);
  const exported = useMemo(() => JSON.stringify(buildExport(data, i18n.language), null, 2), [data, i18n.language]);

  usePageMeta(t("activity.page.metaTitle"), undefined, undefined, {noindex: true});

  const scopeTitle = (scope: string) => {
    const [kind, slug] = scope.split(":");
    if (kind === "lab") {
      const lab = LAB_REGISTRY.find((l) => l.slug === slug);
      return lab ? `${t("activity.page.lab")}: ${getLabText(lab, i18n.language).title}` : scope;
    }
    const lecture = LECTURE_REGISTRY.find((l) => l.slug === slug);
    return lecture ? `${t("activity.page.lecture")}: ${getLectureText(lecture, i18n.language).title}` : scope;
  };

  const hours = Math.floor(summary.activeSeconds / 3600);
  const minutes = Math.floor((summary.activeSeconds % 3600) / 60);

  const download = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(`tt-activity-${date}.json`, exported, "application/json");
  };

  return (
    <div className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <BarChart3 className="h-7 w-7 text-primary"/>
            {t("activity.page.title")}
          </h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">{t("activity.page.intro")}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border bg-background p-4">
          <div>
            <p className="font-medium">{collecting ? t("activity.page.statusOn") : t("activity.page.statusOff")}</p>
            <p className="text-sm text-muted-foreground">{t("activity.page.statusHint")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="activity-collect" checked={collecting} onCheckedChange={(on) => setConsent(on ? "granted" : "denied")}/>
            <Label htmlFor="activity-collect" className="sr-only">{t("activity.page.toggle")}</Label>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("activity.page.progressTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={t("activity.page.duration", {hours, minutes})} label={t("activity.page.activeTime")}/>
            <Stat value={`${summary.solved} / ${summary.attempted}`} label={t("activity.page.tasksSolved")}/>
            <Stat value={String(summary.weeksActive)} label={t("activity.page.weeksActive")}/>
          </div>
          {summary.scopes.length > 0 ? (
            <ul className="space-y-2">
              {summary.scopes.map((scope) => (
                <li key={scope.scope} className="rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{scopeTitle(scope.scope)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t("activity.page.solvedOf", {solved: scope.solved, attempted: scope.attempted})}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{width: `${(scope.solved / scope.attempted) * 100}%`}}/>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("activity.page.noTasks")}</p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="text-xl font-semibold">{t("activity.page.handInTitle")}</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("activity.page.handInStep1")}</li>
            <li>{t("activity.page.handInStep2")}</li>
            <li>{t("activity.page.handInStep3")}</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={download} className="gap-2"><Download className="h-4 w-4"/>{t("activity.page.download")}</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)} className="gap-2"><Trash2 className="h-4 w-4"/>{t("activity.page.delete")}</Button>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("activity.page.showRaw")}</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">{exported}</pre>
          </details>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">{t("activity.page.collectedTitle")}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {(t("activity.page.collected", {returnObjects: true}) as string[]).map((item) => (
                <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">{t("activity.page.notCollectedTitle")}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {(t("activity.page.notCollected", {returnObjects: true}) as string[]).map((item) => (
                <li key={item} className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive"/>{item}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("activity.page.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("activity.page.deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t("activity.page.cancel")}</Button></DialogClose>
            <Button variant="destructive" onClick={() => { deleteActivityData(); setConfirmDelete(false); }}>{t("activity.page.deleteConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
