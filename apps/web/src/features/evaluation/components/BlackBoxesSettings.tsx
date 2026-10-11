import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Box} from "lucide-react";
import {helperCandidates} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {HelpHint} from "@/shared/components/HelpHint.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setBlackBoxes} from "@/shared/ui-state/termSlice.ts";

// Lets the user pick definitions whose calls the automatic stepper runs as one step; applied by the next Run/Evaluate.
export function BlackBoxesSettings() {
  const {t} = useTranslation();
  const ast = useAppSelector((state) => state.term.ast);
  const blackBoxes = useAppSelector((state) => state.term.blackBoxes);
  const dispatch = useAppDispatch();
  const applied = useAppSelector((state) => state.term.evaluation?.blackBoxes ?? []);
  const applyBlackBoxes = (names: string[]) => dispatch(setBlackBoxes(names));
  const candidates = useMemo(() => (ast ? helperCandidates(ast) : []), [ast]);
  const active = blackBoxes.filter((name) => candidates.some((candidate) => candidate.name === name));
  const pending = active.length !== applied.length || active.some((name) => !applied.includes(name));
  if (candidates.length === 0) return null;

  const toggle = (name: string) =>
    applyBlackBoxes(blackBoxes.includes(name) ? blackBoxes.filter((n) => n !== name) : [...blackBoxes, name]);

  return (
    <div className="flex shrink-0 items-center">
      <Popover>
        <Tip label={t("blackBoxes.title")}>
          <PopoverTrigger asChild>
            <Button size="sm" variant={active.length > 0 ? "secondary" : "ghost"} className="h-8 shrink-0 gap-1.5 px-2" aria-label={t("blackBoxes.title")}>
              <Box className="h-4 w-4"/>
              <span className="text-xs">{t("blackBoxes.button")}</span>
              {active.length > 0 && (
                <span className="rounded-full bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">{active.length}</span>
              )}
            </Button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent align="end" className="w-80 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">{t("blackBoxes.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("blackBoxes.description")}</p>
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
            {candidates.map((candidate) => (
              <label
                key={candidate.name}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60",
                  blackBoxes.includes(candidate.name) && "bg-sky-500/10",
                )}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-sky-600"
                  checked={blackBoxes.includes(candidate.name)}
                  onChange={() => toggle(candidate.name)}
                />
                <span className="font-mono">{candidate.name}</span>
                {candidate.recursive && (
                  <Tip label={t("blackBoxes.recursiveTip")}>
                    <span className="ml-auto rounded border px-1 text-[10px] text-muted-foreground">{t("blackBoxes.recursive")}</span>
                  </Tip>
                )}
              </label>
            ))}
          </div>
          {pending && <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">{t("blackBoxes.pending")}</p>}
          {active.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => applyBlackBoxes([])}>{t("blackBoxes.clear")}</Button>
          )}
        </PopoverContent>
      </Popover>
      <HelpHint text={t("blackBoxes.help")}/>
    </div>
  );
}
