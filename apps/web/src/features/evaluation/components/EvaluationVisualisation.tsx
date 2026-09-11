import {useTranslation} from "react-i18next";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useRef, useState} from "react";
import {useFullscreen} from "@/shared/hooks/useFullscreen.ts";
import {motion} from "framer-motion";
import {cn, safeJsonStringify} from "@/shared/lib/utils.ts";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Card, CardContent, CardHeader} from "@/shared/components/ui/card.tsx";
import {Maximize2, Minimize2, Play, TriangleAlert} from "lucide-react";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {Separator} from "@/shared/components/ui/separator.tsx";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {EvaluationStepsViewer, ViewToggle} from "@/features/evaluation/components/EvaluationStepsViewer.tsx";
import {env} from "@/shared/lib/env.ts";

interface EvaluationVisualisationProps {
  className?: string;
}

export function EvaluationVisualisation({
  className,
}: EvaluationVisualisationProps) {
  const {t} = useTranslation();
  const evaluation = useAppSelector((state) => state.term.evaluation);
  const typeAliases = useAppSelector((state) => state.term.typeAliases);
  const hasEvaluation = evaluation !== null && evaluation !== undefined;
  const hasSteps = hasEvaluation && evaluation.steps.length > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const {isFullscreen, isPseudoFullscreen, toggle} = useFullscreen(containerRef);
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const [showGamma, setShowGamma] = useState(false);

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        className,
        "h-full",
        isPseudoFullscreen && "fixed inset-0 z-50 m-0 h-[100dvh] w-[100dvw] overflow-auto bg-background",
      )}
      initial="initial"
      animate="animate"
      variants={fadeInUp}
    >
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 flex-nowrap overflow-x-auto min-w-0 flex-1">
              {hasEvaluation && (
                <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none border-border bg-muted text-muted-foreground whitespace-nowrap shrink-0">
                  {t(`evalStrategy.${evaluation.strategy}.label`)}
                </span>
              )}
              {hasEvaluation && evaluation.divergence && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
                        <TriangleAlert className="h-3 w-3" />
                        {t("evaluationPanel.diverges")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t(
                        evaluation.divergence.kind === "cycle"
                          ? "evaluationPanel.divergesTooltipCycle"
                          : "evaluationPanel.divergesTooltipGrowth",
                        {step: evaluation.divergence.atStep},
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {hasSteps && (
                <>
                  {hasEvaluation && <Separator orientation="vertical" className="shrink-0 data-[orientation=vertical]:h-6" />}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch id="show-gamma" checked={showGamma} onCheckedChange={setShowGamma}/>
                    <Label htmlFor="show-gamma" className="text-sm text-muted-foreground whitespace-nowrap">
                      {t("evaluationPanel.gammaContext")}
                    </Label>
                  </div>
                  <ViewToggle mode={viewMode} onChange={setViewMode}/>
                </>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggle}
              className="shrink-0"
              title={isFullscreen ? t("fullscreen.exit") : t("fullscreen.enter")}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          {hasEvaluation ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 rounded-b-xl border overflow-hidden bg-muted/30 p-4">
                <EvaluationStepsViewer
                  key={evaluation.result.id}
                  evaluation={evaluation}
                  typeAliases={typeAliases}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  showGamma={showGamma}
                />
              </div>
              {env.VITE_SHOW_DEBUG_DATA && (
                <details className="group mx-6 mb-6 mt-4">
                  <summary
                    className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                    <span className="inline-flex items-center gap-2">
                      View Raw Steps Data (DEBUG)
                    </span>
                  </summary>
                  <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                    <pre className="text-xs overflow-x-auto text-foreground/80">
                      {safeJsonStringify(evaluation, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="h-full p-6">
              <EmptyState icon={Play} message={t("evaluationPanel.empty")} />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
