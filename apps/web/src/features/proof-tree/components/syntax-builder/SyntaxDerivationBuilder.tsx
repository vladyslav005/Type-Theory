import {useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import type {SourcePosition} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {SyntaxDerivationTree} from "./SyntaxDerivationTree.tsx";
import {PanZoomCanvas} from "@/features/proof-tree/components/PanZoomCanvas.tsx";
import {syntaxProgress, withChoice, type SyntaxChoices, type SyntaxGoal} from "./syntaxGoal.ts";
import {usePracticeSession} from "@/shared/activity/practiceSession.ts";

interface SyntaxDerivationBuilderProps {
  goal: SyntaxGoal;
  // The term being derived, recorded with the practice session.
  term: string;
  rules: readonly string[];
  onNodeHover?: (pos: SourcePosition | null) => void;
  toolbarTarget?: HTMLElement | null;
}

// Semi-automatic: the student picks each node's rule, the premises follow from the term's shape.
export function SyntaxDerivationBuilder({goal, term, rules, onNodeHover, toolbarTarget}: SyntaxDerivationBuilderProps) {
  const {t} = useTranslation();
  const [choices, setChoices] = useState<SyntaxChoices>({});
  const [checked, setChecked] = useState(false);
  const progress = syntaxProgress(goal, choices);
  const session = usePracticeSession("syntaxDerivation", term);

  const choose = (key: string, rule: string | undefined) => {
    setChoices((current) => withChoice(current, key, rule));
    setChecked(false);
  };

  const status = !checked
    ? t("syntaxBuilder.hint")
    : progress.done
      ? t(progress.belongs ? "syntaxBuilder.doneBelongs" : "syntaxBuilder.doneNotBelongs")
      : progress.wrong > 0
        ? t("syntaxBuilder.wrong", {count: progress.wrong})
        : t("syntaxBuilder.incomplete", {count: progress.unchosen});

  const toolbar = (
    <>
      <p className={checked ? (progress.done ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-destructive") : "text-sm text-muted-foreground"}>
        {status}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => {
          setChecked(true);
          session.update((entry) => ({...entry, checks: entry.checks + 1, ...(progress.done ? {finished: true, allCorrect: true} : {})}));
        }}>{t("proofBuilder.checkProof")}</Button>
        {checked && <Button size="sm" variant="outline" onClick={() => setChecked(false)}>{t("manualBuilder.clearMarks")}</Button>}
        <Button size="sm" variant="ghost" onClick={() => { setChoices({}); setChecked(false); }}>{t("lectureWidgets.reset")}</Button>
      </div>
    </>
  );

  return (
    <div className="w-full h-full flex flex-col space-y-4" {...session.activityProps}>
      {toolbarTarget
        ? createPortal(<div className="flex flex-wrap items-center gap-2">{toolbar}</div>, toolbarTarget)
        : <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-b-xl bg-muted/30 border">{toolbar}</div>}
      <PanZoomCanvas className="flex-1">
        <SyntaxDerivationTree
          goal={goal}
          choices={choices}
          rules={rules}
          onChoose={choose}
          showVerdicts={checked}
          onNodeHover={onNodeHover}
        />
      </PanZoomCanvas>
    </div>
  );
}
