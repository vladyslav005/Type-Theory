import {Fragment, memo, useState} from "react";
import {useTranslation} from "react-i18next";
import {MathJax} from "better-react-mathjax";
import {RotateCcw} from "lucide-react";
import type {SourcePosition} from "@vladyslav005/tt-core";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {expectedChoice, NO_RULE, premisesShown, type SyntaxChoices, type SyntaxGoal} from "./syntaxGoal.ts";
import "@/features/proof-tree/components/proof-tree-using-css/ProofTree.css";
import {Tip} from "@/shared/components/Tip.tsx";

interface SyntaxDerivationTreeProps {
  goal: SyntaxGoal;
  choices: SyntaxChoices;
  rules: readonly string[];
  onChoose: (key: string, rule: string | undefined) => void;
  // Verdicts are only coloured in after the student presses Check, as in the typing builder.
  showVerdicts: boolean;
  compact?: boolean;
  onNodeHover?: (pos: SourcePosition | null) => void;
  root?: boolean;
}

function RulePicker({rules, onPick, children}: {rules: readonly string[]; onPick: (rule: string) => void; children: React.ReactNode}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const pick = (rule: string) => {
    onPick(rule);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-0.5">
          {rules.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => pick(rule)}
              className="w-full text-left font-mono text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
            >
              {rule}
            </button>
          ))}
          <div className="my-1 border-t"/>
          <button
            type="button"
            onClick={() => pick(NO_RULE)}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
          >
            {t("syntaxBuilder.noRule")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const SyntaxDerivationTree = memo(function SyntaxDerivationTree({goal, choices, rules, onChoose, showVerdicts, compact = false, onNodeHover, root = true}: SyntaxDerivationTreeProps) {
  const {t} = useTranslation();
  const choice = choices[goal.key];
  const open = premisesShown(goal, choices);
  const isLeaf = choice !== undefined && (!open || goal.children.length === 0);
  const wrong = choice !== undefined && choice !== expectedChoice(goal);
  // A wrong rule blocks its whole subtree, so it is flagged right away; correct ones wait for Check.
  const verdict = wrong ? "invalid" : showVerdicts && choice !== undefined ? "valid" : undefined;
  const rootClass = root ? "root" : "not-root";
  const leafClass = isLeaf ? "leaf-node" : "not-leaf-node";

  return (
    <div className="proof-node">
      <div className="premises" style={choice === undefined ? {borderBottomStyle: "dashed", opacity: 0.5} : undefined}>
        {open && goal.children.map((child, i) => (
          <Fragment key={child.key}>
            <SyntaxDerivationTree
              goal={child}
              choices={choices}
              rules={rules}
              onChoose={onChoose}
              showVerdicts={showVerdicts}
              compact={compact}
              onNodeHover={onNodeHover}
              root={false}
            />
            {i !== goal.children.length - 1 && <div className="inter-proof"/>}
          </Fragment>
        ))}
      </div>

      <div className={`conclusion ${rootClass} ${leafClass}`}>
        <div className="conclusion-left"/>
        <div
          className={cn(
            `conclusion-center ${leafClass} ${rootClass} rounded-md px-2 flex items-center gap-2 transition-all duration-200`,
            compact ? "my-1 text-xs" : "my-1.5",
            verdict === "invalid" && "bg-destructive/10 border border-destructive/30 dark:bg-destructive/15 dark:border-destructive/40",
            verdict === "valid" && "bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-500/15 dark:border-emerald-500/40",
          )}
          onMouseEnter={goal.pos && onNodeHover ? () => onNodeHover(goal.pos!) : undefined}
          onMouseLeave={onNodeHover ? () => onNodeHover(null) : undefined}
        >
          {goal.tex !== undefined
            ? <MathJax key={goal.tex}>{`\\[ ${goal.tex} \\]`}</MathJax>
            : <span className="font-mono whitespace-nowrap">{goal.text} ∈ <i>Term</i></span>}
          {choice !== undefined && (
            <Tip label={t("proofBuilder.resetNode")}>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                onClick={() => onChoose(goal.key, undefined)}
              >
                <RotateCcw className="h-3 w-3"/>
              </button>
            </Tip>
          )}
        </div>
        <div className="conclusion-right">
          <Tip label={wrong ? t("syntaxBuilder.doesNotFitTooltip") : undefined}>
            <RulePicker rules={rules} onPick={(rule) => onChoose(goal.key, rule)}>
              <p
                className={cn(
                  "rule-name cursor-pointer select-none hover:underline whitespace-nowrap",
                  compact && "text-xs",
                  wrong && "text-destructive",
                )}
              >
                {choice === undefined ? t("proofBuilder.pickRule") : choice === NO_RULE ? t("syntaxBuilder.noRuleShort") : choice}
                {wrong && <span className="ml-1.5 text-[10px] font-sans not-italic">{t("syntaxBuilder.doesNotFit")}</span>}
              </p>
            </RulePicker>
          </Tip>
        </div>
      </div>
    </div>
  );
});
