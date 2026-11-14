import {useEffect, useState} from "react";
import {trackTask, useTaskId} from "@/shared/activity/taskTracking.ts";
import {useSavedState} from "@/shared/activity/savedWork.ts";
import {useTranslation} from "react-i18next";
import {Check, X} from "lucide-react";
import {MathJax} from "better-react-mathjax";
import {Button} from "@/shared/components/ui/button.tsx";
import {useMiniWorkspace} from "@/features/docs/workspace/useMiniWorkspace.ts";
import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import {typeToString, type AntlrParserAdapter} from "@vladyslav005/tt-core";
import {TaskActions} from "@/features/docs/labs/components/taskUi.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import type {TypeTheoryConfig} from "@vladyslav005/tt-core";

interface PredictThenVerifyProps {
  id?: string;
  term: string;
  prompt?: string;
  theories?: Partial<TypeTheoryConfig>;
}

// Parsed as a lambda's parameter type, so redundant parens and spacing don't matter but structure does.
function readType(parser: AntlrParserAdapter, text: string): string | undefined {
  try {
    const term = parser.parseExpression(`λ guess : ${text} . guess;`).term;
    return term?.kind === "Abs" && term.paramType ? typeToString(term.paramType) : undefined;
  } catch {
    return undefined;
  }
}

export function PredictThenVerify({id, term, prompt, theories}: PredictThenVerifyProps) {
  const {t} = useTranslation();
  const {parser} = useDependencies();
  const taskId = useTaskId(id);
  const {check, result, error, checked} = useMiniWorkspace(term, theories);
  const [guess, setGuess] = useSavedState(taskId && `${taskId}#guess`, "");
  const [revealed, setRevealed] = useState(false);

  const reveal = () => {
    setRevealed(true);
    check();
  };

  const reset = () => {
    setRevealed(false);
    setGuess("");
  };

  const guessType = revealed && guess.trim() ? readType(parser, guess) : undefined;
  const unreadable = revealed && !!guess.trim() && !guessType;
  const matches = revealed && !!result && guessType === result.typeText;

  useEffect(() => {
    if (!revealed || !checked) return;
    trackTask(taskId, {ok: matches, kind: matches ? undefined : !guess.trim() ? "noGuess" : unreadable ? "cannotRead" : "mismatch"});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal
  }, [revealed, checked]);

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("lectureWidgets.checkpoint")}</p>

      <LabEditor value={term} onChange={() => {}} readOnly compact className="w-full bg-background"/>

      <p className="text-sm text-muted-foreground">{prompt ?? t("lectureWidgets.predictPrompt")}</p>

      <div>
        <LabEditor
          value={guess}
          onChange={setGuess}
          onSubmit={revealed ? undefined : reveal}
          placeholder={t("lectureWidgets.predictPlaceholder")}
          readOnly={revealed}
          compact
          className={cn("w-full max-w-xs", revealed && "opacity-50")}
        />
      </div>
      <TaskActions>
        {revealed ? (
          <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.tryAgain")}</Button>
        ) : (
          <Button size="sm" onClick={reveal}>{t("lectureWidgets.reveal")}</Button>
        )}
      </TaskActions>

      {revealed && checked && (
        result ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {matches ? <Check className="h-4 w-4 text-emerald-500"/> : <X className="h-4 w-4 text-amber-500"/>}
            <span className="text-muted-foreground">{t("lectureWidgets.actualType")}</span>
            <MathJax inline>{`\\(${result.typeTex}\\)`}</MathJax>
            {!matches && guess.trim() && (
              <span className="text-xs text-muted-foreground">{t(unreadable ? "lectureWidgets.unreadableType" : "lectureWidgets.looseMatch")}</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        )
      )}
    </div>
  );
}
