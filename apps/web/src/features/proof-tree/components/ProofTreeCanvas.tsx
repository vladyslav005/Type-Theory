import {TransformWrapper, TransformComponent} from "react-zoom-pan-pinch";
import {useTranslation} from "react-i18next";
import {ZoomIn, ZoomOut, Crosshair, ChevronLeft, ChevronRight, RotateCcw} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {ProofTreeComponentUsingCss} from "@/features/proof-tree/components/proof-tree-using-css/ProofTreeTex.tsx";
import {TexRefExpansionProvider} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";
import {StepBuildProvider} from "@/features/proof-tree/components/proof-tree-using-css/StepBuildContext.tsx";
import {useStepBuild} from "@/features/proof-tree/hooks/useStepBuild.ts";
import {ExportLatexButtons} from "@/features/proof-tree/components/ExportLatexButtons.tsx";
import type {TexTree} from "@vladyslav005/tt-core";
import type {SourcePosition} from "@vladyslav005/tt-core";

// Drives the same bottom-center step bar as the derivation-build "step by step" mode, but from
// externally-owned state (an inference trace) instead of useStepBuild's internal reveal order.
export interface InferenceStepControl {
  index: number;
  total: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  caption?: string;
}

interface ProofTreeCanvasProps {
  texTree: TexTree;
  treeKey: string;
  stepByStep?: boolean;
  exportFilename?: string;
  onNodeHover?: (pos: SourcePosition | null) => void;
  inferenceStepControl?: InferenceStepControl;
  highlightedNodeIds?: ReadonlySet<string>;
}

// The pan/zoom viewport shared by every read-only proof tree tab (type-theory, logic, ...).
export function ProofTreeCanvas({texTree, treeKey, stepByStep = false, exportFilename = "proof-tree.tex", onNodeHover, inferenceStepControl, highlightedNodeIds}: ProofTreeCanvasProps) {
  const {t} = useTranslation();
  const {isRevealed, step, total, canGoNext, canGoPrev, goNext, goPrev, reset} =
    useStepBuild(texTree, treeKey, stepByStep);

  return (
    <div className="flex-1 w-full relative rounded-b-xl bg-muted/30 border overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={3}
        centerOnInit={true}
        wheel={{step: 0.1}}
        doubleClick={{mode: "zoomIn"}}
        panning={{velocityDisabled: true}}
        limitToBounds={false}
      >
        {({zoomIn, zoomOut, centerView}) => (
          <TexRefExpansionProvider key={treeKey}>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <ExportLatexButtons buildTree={() => texTree} filename={exportFilename}/>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => zoomIn()}
                className="shadow-lg hover:shadow-xl transition-shadow"
                title={t("proofTreeCanvas.zoomIn")}
              >
                <ZoomIn className="h-4 w-4"/>
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => zoomOut()}
                className="shadow-lg hover:shadow-xl transition-shadow"
                title={t("proofTreeCanvas.zoomOut")}
              >
                <ZoomOut className="h-4 w-4"/>
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => centerView()}
                className="shadow-lg hover:shadow-xl transition-shadow"
                title={t("proofTreeCanvas.centerView")}
              >
                <Crosshair className="h-4 w-4"/>
              </Button>
            </div>

            {stepByStep && !inferenceStepControl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg bg-secondary/95 px-3 py-2 shadow-lg backdrop-blur">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  className="h-8 w-8"
                  title={t("proofTreeCanvas.prevStep")}
                >
                  <ChevronLeft className="h-4 w-4"/>
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap px-1">
                  {t("proofTreeCanvas.stepCount", {step, total})}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="h-8 w-8"
                  title={t("proofTreeCanvas.nextStep")}
                >
                  <ChevronRight className="h-4 w-4"/>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={reset}
                  disabled={!canGoPrev}
                  className="h-8 w-8"
                  title={t("proofTreeCanvas.restart")}
                >
                  <RotateCcw className="h-4 w-4"/>
                </Button>
              </div>
            )}

            {inferenceStepControl && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 rounded-lg bg-secondary/95 px-3 py-2 shadow-lg backdrop-blur max-w-[90%]">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={inferenceStepControl.onPrev}
                    disabled={!inferenceStepControl.canGoPrev}
                    className="h-8 w-8"
                    title={t("proofTreeCanvas.prevStep")}
                  >
                    <ChevronLeft className="h-4 w-4"/>
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap px-1">
                    {t("proofTreeCanvas.stepCount", {step: inferenceStepControl.index + 1, total: inferenceStepControl.total})}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={inferenceStepControl.onNext}
                    disabled={!inferenceStepControl.canGoNext}
                    className="h-8 w-8"
                    title={t("proofTreeCanvas.nextStep")}
                  >
                    <ChevronRight className="h-4 w-4"/>
                  </Button>
                </div>
                {inferenceStepControl.caption && (
                  <span className="text-xs font-mono text-muted-foreground text-center truncate max-w-full">
                    {inferenceStepControl.caption}
                  </span>
                )}
              </div>
            )}

            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full !flex !items-center !justify-center"
              wrapperStyle={{width: '100%', height: '100%', overflow: 'hidden'}}
            >
              <div className="flex items-center justify-center p-6">
                <StepBuildProvider value={{enabled: stepByStep && !inferenceStepControl, isRevealed}}>
                  <ProofTreeComponentUsingCss node={texTree} onNodeHover={onNodeHover} highlightedNodeIds={highlightedNodeIds}/>
                </StepBuildProvider>
              </div>
            </TransformComponent>
          </TexRefExpansionProvider>
        )}
      </TransformWrapper>
    </div>
  );
}
