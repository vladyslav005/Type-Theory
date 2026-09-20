import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowRight} from "lucide-react";
import {MathJax} from "better-react-mathjax";
import {Button} from "@/shared/components/ui/button.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/shared/components/ui/select.tsx";
import {useDependencies} from "@/app/providers/di/DependencyProvider.tsx";
import {TexMapper} from "@vladyslav005/tt-core";
import {
  EvaluationStrategy,
  type ReductionStep,
} from "@vladyslav005/tt-core";

interface ReductionStrategyExplorerProps {
  term: string;
  hint?: string;
}

const STRATEGIES = Object.values(EvaluationStrategy);

export function ReductionStrategyExplorer({term, hint}: ReductionStrategyExplorerProps) {
  const {t} = useTranslation();
  const {parser, evaluator} = useDependencies();
  const [strategy, setStrategy] = useState<EvaluationStrategy>(EvaluationStrategy.CALL_BY_VALUE);
  const [steps, setSteps] = useState<ReductionStep[] | undefined>();
  const [resultTex, setResultTex] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const run = () => {
    try {
      const ast = parser.parseExpression(term);
      const evaluation = evaluator.evaluate(ast, strategy);
      setSteps(evaluation.steps);
      setResultTex(TexMapper.termToTex(evaluation.result));
      setError(evaluation.errors?.[0]?.message);
    } catch (e) {
      setSteps(undefined);
      setResultTex(undefined);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setSteps(undefined);
    setResultTex(undefined);
    setError(undefined);
    setStrategy(EvaluationStrategy.CALL_BY_VALUE);
  };

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("lectureWidgets.tryStrategies")}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <pre className="font-mono text-sm rounded-md border bg-background p-3 overflow-x-auto">{term}</pre>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={strategy} onValueChange={(v) => setStrategy(v as EvaluationStrategy)}>
          <SelectTrigger size="sm" className="w-44"><SelectValue/></SelectTrigger>
          <SelectContent>
            {STRATEGIES.map((s) => (
              <SelectItem key={s} value={s}>{t(`evalStrategy.${s}.label`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={run}>{t("lectureWidgets.run")}</Button>
        {steps && <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.reset")}</Button>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {steps && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("lectureWidgets.steps", {count: steps.length, strategy: t(`evalStrategy.${strategy}.label`)})}
          </p>
          <ol className="space-y-1.5 text-sm">
            {steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                <MathJax inline>{`\\(${TexMapper.termToTex(step.before)}\\)`}</MathJax>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                <MathJax inline>{`\\(${TexMapper.termToTex(step.after)}\\)`}</MathJax>
              </li>
            ))}
          </ol>
          {resultTex && (
            <p className="text-sm pt-1">
              <span className="text-muted-foreground">{t("lectureWidgets.result")} </span>
              <MathJax inline>{`\\(${resultTex}\\)`}</MathJax>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
