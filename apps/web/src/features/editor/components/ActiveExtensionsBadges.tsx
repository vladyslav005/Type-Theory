import { TYPE_THEORIES, type TypeTheoryId } from "@vladyslav005/tt-core";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/shared/hooks/reduxHooks.ts";
import { cn } from "@/shared/lib/utils.ts";

const SWATCH: Record<TypeTheoryId, string> = {
  letPolymorphism: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
  typeInference: "border-teal-300 bg-teal-100 text-teal-700 dark:border-teal-700 dark:bg-teal-900 dark:text-teal-300",
  isoRecursiveTypes: "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300",
  systemF: "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  systemFOmega: "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-900 dark:text-violet-300",
  systemLambdaP: "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

const STLC_SWATCH = "border-border bg-muted text-muted-foreground";

export function ActiveExtensionsBadges({className}: {className?: string}) {
  const {t} = useTranslation();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const enabled = TYPE_THEORIES.filter((theory) => enabledTheories[theory.id]);

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${STLC_SWATCH}`}>
        STLC
      </span>
      {enabled.map((theory) => (
        <span
          key={theory.id}
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${SWATCH[theory.id]}`}
        >
          {t(`extensions.theories.${theory.id}.shortLabel`, theory.shortLabel)}
        </span>
      ))}
    </div>
  );
}
