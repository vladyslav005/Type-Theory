import {useEffect, useState} from "react";
import {trackTask, useTaskId} from "@/shared/activity/taskTracking.ts";
import {useTranslation} from "react-i18next";
import {Check, X} from "lucide-react";
import {MathJax} from "better-react-mathjax";
import {Button} from "@/shared/components/ui/button.tsx";
import {useMiniWorkspace} from "@/features/docs/workspace/useMiniWorkspace.ts";

interface PredictThenVerifyProps {
  id?: string;
  term: string;
  prompt?: string;
}

// Loose match on purpose — comparing against a hand-typed guess, not re-parsing it.
const normalize = (s: string) => s.replace(/[()\s]/g, "");

export function PredictThenVerify({id, term, prompt}: PredictThenVerifyProps) {
  const {t} = useTranslation();
  const taskId = useTaskId(id);
  const {check, result, error, checked} = useMiniWorkspace(term);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);

  const reveal = () => {
    setRevealed(true);
    check();
  };

  const reset = () => {
    setRevealed(false);
    setGuess("");
  };

  const matches = revealed && !!result && normalize(guess) === normalize(result.typeText);

  useEffect(() => {
    if (!revealed || !checked) return;
    trackTask(taskId, {ok: matches, kind: matches ? undefined : guess.trim() ? "mismatch" : "noGuess"});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal
  }, [revealed, checked]);

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("lectureWidgets.checkpoint")}</p>

      <pre className="font-mono text-sm rounded-md border bg-background p-3 overflow-x-auto">{term}</pre>

      <p className="text-sm text-muted-foreground">{prompt ?? t("lectureWidgets.predictPrompt")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <textarea
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={t("lectureWidgets.predictPlaceholder")}
          disabled={revealed}
          rows={1}
          spellCheck={false}
          className="w-full max-w-xs min-h-9 resize-y font-mono text-sm rounded-md border bg-transparent px-3 py-1.5 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {revealed ? (
          <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.tryAgain")}</Button>
        ) : (
          <Button size="sm" onClick={reveal}>{t("lectureWidgets.reveal")}</Button>
        )}
      </div>

      {revealed && checked && (
        result ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {matches ? <Check className="h-4 w-4 text-emerald-500"/> : <X className="h-4 w-4 text-amber-500"/>}
            <span className="text-muted-foreground">{t("lectureWidgets.actualType")}</span>
            <MathJax inline>{`\\(${result.typeTex}\\)`}</MathJax>
            {!matches && (
              <span className="text-xs text-muted-foreground">{t("lectureWidgets.looseMatch")}</span>
            )}
          </div>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        )
      )}
    </div>
  );
}
