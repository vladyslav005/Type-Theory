import type {EvaluationResult} from "@vladyslav005/tt-core";
import {EvaluationStepsViewer} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";

// An evaluation task's solution, shown with the editor's own step-by-step viewer.
export function SolutionSteps({evaluation, numerals, showGamma = false}: {evaluation: EvaluationResult; numerals: "church" | "nbl" | "none"; showGamma?: boolean}) {
  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-xl border bg-muted/30 p-4">
      <EvaluationStepsViewer key={evaluation.result.id} evaluation={evaluation} showGamma={showGamma} numerals={numerals}/>
    </div>
  );
}
