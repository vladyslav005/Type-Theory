import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {checkProof, enterBuildMode, exitBuildMode} from "@/shared/ui-state/termSlice.ts";
import {countProofErrors, summarizeStudentTree} from "@/shared/ui-state/studentProof.ts";
import {ProofTreeBuilderNode} from "@/features/proof-tree/components/proof-tree-builder/ProofTreeBuilderNode.tsx";
import {buildGammaRegistry} from "@/features/proof-tree/components/proof-tree-builder/buildGammaRegistry.ts";
import {studentNodeToExportTree} from "@/features/proof-tree/components/proof-tree-builder/studentProofToTex.ts";
import {GammaRegistry} from "@vladyslav005/tt-core";
import {TexRefExpansionProvider} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";
import {ExportLatexButtons} from "@/features/proof-tree/components/ExportLatexButtons.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {cn, safeJsonStringify} from "@/shared/lib/utils.ts";
import {TransformWrapper, TransformComponent} from "react-zoom-pan-pinch";
import {ZoomIn, ZoomOut, Crosshair, Hammer} from "lucide-react";
import {env} from "@/shared/lib/env.ts";
import {ManualBuilder} from "@/features/proof-tree/manual/ManualBuilder.tsx";
import {EmptyState} from "@/shared/components/EmptyState.tsx";

export function ProofTreeBuilder() {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {studentTree, answerKey, mode} = useAppSelector((state) => state.term.buildMode);
  const proof = useAppSelector((state) => state.term.proof);
  const [highlightMistakes, setHighlightMistakes] = useState(false);
  // Hook must run unconditionally, before the early return below.
  const registry = useMemo(() => (answerKey ? buildGammaRegistry(answerKey) : new GammaRegistry()), [answerKey]);

  if (mode === "manual" && answerKey) return <ManualBuilder/>;

  if (!studentTree || !answerKey) {
    const hasErrors = !proof || countProofErrors(proof) > 0;
    return (
      <div className="h-full p-6">
        <EmptyState
          icon={Hammer}
          message={
            !proof
              ? t("proofBuilder.emptyNeedsTerm")
              : hasErrors
                ? t("proofBuilder.emptyHasErrors")
                : t("proofBuilder.emptyInstructions")
          }
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              disabled={hasErrors}
              title={t("proofBuilder.modeSemiHint")}
              onClick={() => dispatch(enterBuildMode("semi"))}
            >
              {t("proofBuilder.modeSemi")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={hasErrors}
              title={t("proofBuilder.modeManualHint")}
              onClick={() => dispatch(enterBuildMode("manual"))}
            >
              {t("proofBuilder.modeManual")}
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const summary = summarizeStudentTree(studentTree);

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-b-xl bg-muted/30 border">
        <p className="text-sm text-muted-foreground">
          {t("proofBuilder.nodesFilled", {filled: summary.filled, total: summary.total})}
          {summary.filled > 0 && (
            <>
              {" — "}
              <span className={cn(summary.invalid === 0 && "text-emerald-600 dark:text-emerald-400")}>
                {t("proofBuilder.valid", {count: summary.valid})}
              </span>
              {summary.invalid > 0 && <span className="text-destructive">, {t("proofBuilder.invalid", {count: summary.invalid})}</span>}
            </>
          )}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="highlight-mistakes" checked={highlightMistakes} onCheckedChange={setHighlightMistakes}/>
            <Label htmlFor="highlight-mistakes" className="text-sm text-muted-foreground cursor-pointer">
              {t("proofBuilder.highlightMistakes")}
            </Label>
          </div>
          <Button size="sm" onClick={() => dispatch(checkProof())}>{t("proofBuilder.checkProof")}</Button>
          <Button size="sm" variant="ghost" onClick={() => dispatch(exitBuildMode())}>{t("proofBuilder.exit")}</Button>
        </div>
      </div>

      <div className="flex-1 w-full relative rounded-xl bg-muted/30 border overflow-hidden">
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
            <TexRefExpansionProvider key={answerKey.id ?? "none"}>
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <ExportLatexButtons
                  buildTree={(expandedKeys) => studentNodeToExportTree(
                    studentTree,
                    answerKey,
                    answerKey.gamma,
                    registry,
                    {expandedKeys, highlightMistakes},
                  )}
                  filename="proof-tree-builder.tex"
                />
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

              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full !flex !items-center !justify-center"
                wrapperStyle={{width: "100%", height: "100%", overflow: "hidden"}}
              >
                <div className="flex items-center justify-center p-6">
                  <ProofTreeBuilderNode
                    studentNode={studentTree}
                    answerNode={answerKey}
                    parentGamma={answerKey.gamma}
                    registry={registry}
                    highlightMistakes={highlightMistakes}
                  />
                </div>
              </TransformComponent>
            </TexRefExpansionProvider>
          )}
        </TransformWrapper>
      </div>

      {env.VITE_SHOW_DEBUG_DATA && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
            <span className="inline-flex items-center gap-2">
              View Raw Student Proof Data (DEBUG)
            </span>
          </summary>
          <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
            <pre className="text-xs overflow-x-auto text-foreground/80">
              {safeJsonStringify({studentTree, answerKey, summary}, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
