import {useTranslation} from "react-i18next";
import {cn, safeJsonStringify} from "@/shared/lib/utils.ts";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useProofHooks} from "@/shared/hooks/processProofHooks.ts";
import {motion} from "framer-motion";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Card, CardContent, CardHeader} from "@/shared/components/ui/card.tsx";
import {Maximize2, Minimize2, ListTree, Info} from "lucide-react";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {isPlainStlc, isPlainStlcProof, typeToString} from "@vladyslav005/tt-core";
import {ProofTreeCanvas} from "@/features/proof-tree/components/ProofTreeCanvas.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {useEffect, useRef, useState} from "react";
import type {RefObject} from "react";
import {useFullscreen} from "@/shared/hooks/useFullscreen";
import {Tabs, TabsList, TabsTrigger} from "@/shared/components/ui/tabs.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {countProofErrors} from "@/shared/ui-state/studentProof.ts";
import {ProofTreeBuilder} from "@/features/proof-tree/components/proof-tree-builder/ProofTreeBuilder.tsx";
import {InferenceConstraintList} from "@/features/proof-tree/components/InferenceConstraintList.tsx";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {env} from "@/shared/lib/env.ts";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import type {SourcePosition} from "@vladyslav005/tt-core";


interface ProofTreeVisualisationProps {
  className?: string;
  editorRef?: RefObject<TextEditorHandle | null>;
}

type ProofTreeTab = "automatic" | "logic" | "build-check";

export function ProofTreeVisualisation({
                                         className,
                                         editorRef,
                                       }: ProofTreeVisualisationProps) {
  const {t} = useTranslation();
  const proof = useAppSelector((state) => state.term.proof);
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const inferenceSteps = useAppSelector((state) => state.term.inferenceSteps);
  const inferenceProofSnapshots = useAppSelector((state) => state.term.inferenceProofSnapshots);
  const {toTexTree, toLogicTree} = useProofHooks()
  const containerRef = useRef<HTMLDivElement>(null);
  const {isFullscreen, isPseudoFullscreen, toggle} = useFullscreen(containerRef);
  // Not Radix's <TabsContent> — mounting TransformWrapper inside it hung the tab.
  const [activeTab, setActiveTab] = useState<ProofTreeTab>("automatic");
  const [stepByStep, setStepByStep] = useState(false);
  const [highlightOnHover, setHighlightOnHover] = useState(true);
  const [showInferenceSteps, setShowInferenceSteps] = useState(false);
  const [showConstraintList, setShowConstraintList] = useState(false);
  const [inferenceStepIndex, setInferenceStepIndex] = useState(0);
  // A fresh result invalidates whatever step the user was on — reset during render (the
  // React-endorsed way to adjust state when a prop changes) rather than in an effect.
  const [snapshotsForStepIndex, setSnapshotsForStepIndex] = useState(inferenceProofSnapshots);
  if (snapshotsForStepIndex !== inferenceProofSnapshots) {
    setSnapshotsForStepIndex(inferenceProofSnapshots);
    setInferenceStepIndex(0);
  }

  // inferenceProofSnapshots always has one more entry than inferenceSteps — snapshot 0 is the
  // raw, nothing-solved-yet tree, snapshot i+1 is the tree right after inferenceSteps[i] solved.
  // Also gated on the theory that actually causes inference to happen — constraints get
  // generated/solved internally even in plain STLC, but that's implementation plumbing, not
  // something meaningful to show unless Let-polymorphism or Type inference is actually on.
  const hasInferenceSteps = inferenceSteps.length > 0
    && (enabledTheories.letPolymorphism || enabledTheories.typeInference);
  const clampedInferenceIndex = Math.min(inferenceStepIndex, inferenceProofSnapshots.length - 1);
  const isInferenceStepping = showInferenceSteps && hasInferenceSteps;
  const isInitialInferenceStep = clampedInferenceIndex === 0;

  const handleNodeHover = highlightOnHover
    ? (pos: SourcePosition | null) => editorRef?.current?.highlightRange?.(pos)
    : undefined;

  // Clear any lingering highlight when leaving the automatic tab, the switch is off,
  // or this panel unmounts — otherwise a stale highlight sticks in the text editor.
  useEffect(() => {
    const editor = editorRef?.current;
    return () => editor?.highlightRange?.(null);
  }, [activeTab, editorRef]);

  // Highlights the source range the current inference step's constraint came from, independent
  // of hover — lets you see which part of the code produced the constraint being solved.
  useEffect(() => {
    if (!isInferenceStepping || isInitialInferenceStep) return;
    const editor = editorRef?.current;
    const pos = inferenceSteps[clampedInferenceIndex - 1]?.constraint.pos;
    editor?.highlightRange?.(pos ?? null);
    return () => editor?.highlightRange?.(null);
  }, [isInferenceStepping, isInitialInferenceStep, clampedInferenceIndex, inferenceSteps, editorRef]);

  // Untyped lambda calculus has no type derivation to visualize — always show the
  // placeholder here, even if `check()` produced a (typeless) proof or an error.
  const hasProof = !enabledTheories.untyped && proof !== null && proof !== undefined;
  // Gate on the rules the proof actually uses, not on which extensions are toggled on — a plain
  // λ-term still has a clean Curry-Howard reading even with System F et al. enabled, and a term
  // that reaches for a non-STLC rule doesn't regardless.
  const showLogicTab = hasProof
    ? isPlainStlcProof(proof)
    : isPlainStlc(enabledTheories);
  const effectiveTab: ProofTreeTab =
    (activeTab === "logic" && !showLogicTab) || (activeTab === "build-check" && enabledTheories.untyped)
      ? "automatic"
      : activeTab;

  // While stepping through inference, render the partially-solved snapshot instead of the
  // final proof — same tree shape, so this is the only thing that needs to change.
  // With inference on, the derivation is shown as the checker builds it — before its constraints
  // are solved (fresh variables 'A, 'B, ...); stepping through the solving is opt-in. A failed
  // solve keeps the final tree, since only that one carries the error.
  const showUnresolved = hasInferenceSteps && !!proof && countProofErrors(proof) === 0;
  const displayedProof = isInferenceStepping
    ? inferenceProofSnapshots[clampedInferenceIndex]
    : showUnresolved ? inferenceProofSnapshots[0] : proof;
  const texTree = displayedProof ? toTexTree(displayedProof) : null;
  const logicTree = proof && showLogicTab ? toLogicTree(proof) : null;
  // undefined at the initial (nothing solved yet) step — there's no "just solved" constraint yet.
  const currentInferenceStep = isInferenceStepping && !isInitialInferenceStep
    ? inferenceSteps[clampedInferenceIndex - 1]
    : undefined;
  const highlightedNodeIds = currentInferenceStep
    ? new Set(currentInferenceStep.affectedNodeIds)
    : undefined;
  const inferenceCaption = !isInferenceStepping
    ? undefined
    : isInitialInferenceStep
      ? t("proofTree.inferenceInitial")
      : currentInferenceStep
        ? [
            `${t("proofTree.justSolvedConstraint")}: ${typeToString(currentInferenceStep.constraint.left)} ~ ${typeToString(currentInferenceStep.constraint.right)}`,
            currentInferenceStep.error
              ? currentInferenceStep.error
              : currentInferenceStep.newBindings.length > 0
                ? currentInferenceStep.newBindings.map((b) => `${b.name} := ${typeToString(b.type)}`).join(", ")
                : t("proofTree.noNewBindings"),
          ].join("  •  ")
        : undefined;

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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
              <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as ProofTreeTab)}>
                <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
                  <TabsTrigger value="automatic">{t("proofTree.tabAutomatic")}</TabsTrigger>
                  {enabledTheories.untyped ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <TabsTrigger value="build-check" disabled>{t("proofTree.tabBuildCheck")}</TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{t("proofTree.buildCheckUnavailableUntyped")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TabsTrigger value="build-check">{t("proofTree.tabBuildCheck")}</TabsTrigger>
                  )}
                  {showLogicTab ? (
                    <TabsTrigger value="logic">{t("proofTree.tabLogic")}</TabsTrigger>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <TabsTrigger value="logic" disabled>{t("proofTree.tabLogicShort")}</TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {hasProof
                            ? t("proofTree.logicUnavailableNonStlc")
                            : t("proofTree.logicUnavailableExtensions")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TabsList>
              </Tabs>

              {effectiveTab === "automatic" && hasProof && hasInferenceSteps && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="show-inference-steps"
                          checked={showInferenceSteps}
                          onCheckedChange={(checked) => {
                            setShowInferenceSteps(checked);
                            if (checked) setStepByStep(false);
                          }}
                        />
                        <Label htmlFor="show-inference-steps" className="text-sm text-muted-foreground whitespace-nowrap">
                          {t("proofTree.showInferenceSteps")}
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64">{t("proofTree.showInferenceStepsTooltip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {effectiveTab === "automatic" && isInferenceStepping && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-constraint-list"
                    checked={showConstraintList}
                    onCheckedChange={setShowConstraintList}
                  />
                  <Label htmlFor="show-constraint-list" className="text-sm text-muted-foreground whitespace-nowrap">
                    {t("proofTree.showConstraintList")}
                  </Label>
                </div>
              )}

              {effectiveTab === "automatic" && hasProof && !isInferenceStepping && (
                <div className="flex items-center gap-2">
                  <Switch id="step-by-step" checked={stepByStep} onCheckedChange={setStepByStep}/>
                  <Label htmlFor="step-by-step" className="text-sm text-muted-foreground whitespace-nowrap">
                    {t("proofTree.stepByStep")}
                  </Label>
                </div>
              )}

              {effectiveTab === "automatic" && hasProof && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="highlight-on-hover"
                    checked={highlightOnHover}
                    onCheckedChange={(checked) => {
                      setHighlightOnHover(checked);
                      if (!checked) editorRef?.current?.highlightRange?.(null);
                    }}
                  />
                  <Label htmlFor="highlight-on-hover" className="text-sm text-muted-foreground whitespace-nowrap">
                    {t("proofTree.highlightInEditor")}
                  </Label>
                </div>
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
        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="flex-1 min-h-0 overflow-hidden">
          {effectiveTab === "build-check" ? (
            <div className="h-full overflow-auto">
              <ProofTreeBuilder/>
            </div>
          ) : !hasProof ? (
            <div className="h-full p-6">
              <EmptyState icon={ListTree} message={t(enabledTheories.untyped ? "proofTree.emptyUntyped" : "proofTree.empty")} />
            </div>
          ) : effectiveTab === "logic" ? (
            logicTree ? (
              <div className="w-full h-full flex flex-col">
                <ProofTreeCanvas texTree={logicTree} treeKey={`logic-${proof?.id ?? "none"}`} exportFilename="logic-tree.tex"/>
                {env.VITE_SHOW_DEBUG_DATA && (
                  <details className="group mx-6 mb-6 mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                      <span className="inline-flex items-center gap-2">
                        View Raw Logic Tree Data (DEBUG)
                      </span>
                    </summary>
                    <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                      <pre className="text-xs overflow-x-auto text-foreground/80">
                        {safeJsonStringify(logicTree, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="h-full p-6">
                <EmptyState icon={Info} message={t("proofTree.logicEmpty")} />
              </div>
            )
          ) : (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 min-h-0 flex">
                <div className="flex-1 min-w-0 flex flex-col">
                  {texTree && (
                    <ProofTreeCanvas
                      texTree={texTree}
                      treeKey={proof?.id ?? "none"}
                      stepByStep={!isInferenceStepping && stepByStep}
                      exportFilename="proof-tree.tex"
                      onNodeHover={handleNodeHover}
                      highlightedNodeIds={highlightedNodeIds}
                      inferenceStepControl={isInferenceStepping ? {
                        index: clampedInferenceIndex,
                        total: inferenceProofSnapshots.length,
                        canGoPrev: clampedInferenceIndex > 0,
                        canGoNext: clampedInferenceIndex < inferenceProofSnapshots.length - 1,
                        onPrev: () => setInferenceStepIndex((i) => Math.max(0, i - 1)),
                        onNext: () => setInferenceStepIndex((i) => Math.min(inferenceProofSnapshots.length - 1, i + 1)),
                        caption: inferenceCaption,
                      } : undefined}
                    />
                  )}
                </div>
                {isInferenceStepping && showConstraintList && (
                  <InferenceConstraintList
                    steps={inferenceSteps}
                    activeIndex={clampedInferenceIndex - 1}
                    // Clicking the row already showing "just applied" cancels it — back to
                    // right before that constraint, rather than only ever jumping forward.
                    onSelect={(i) => setInferenceStepIndex((current) => current === i + 1 ? i : i + 1)}
                  />
                )}
              </div>
              {env.VITE_SHOW_DEBUG_DATA && (
                <details className="group mx-6 mb-6 mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                    <span className="inline-flex items-center gap-2">
                      View Raw Proof Data (DEBUG)
                    </span>
                  </summary>
                  <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                    <pre className="text-xs overflow-x-auto text-foreground/80">
                      {safeJsonStringify(proof, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          )}
          </div>
        </CardContent>
      </Card>

    </motion.div>

  )
}
