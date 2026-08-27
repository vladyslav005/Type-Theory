import {cn} from "@/shared/lib/utils.ts";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useProofHooks} from "@/shared/hooks/processProofHooks.ts";
import {motion} from "framer-motion";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Card, CardContent, CardHeader} from "@/shared/components/ui/card.tsx";
import {Maximize2, Minimize2, ListTree, Info} from "lucide-react";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {isPlainStlc, isPlainStlcProof} from "@vladyslav005/tt-core";
import {ProofTreeCanvas} from "@/features/proof-tree/components/ProofTreeCanvas.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {useEffect, useRef, useState} from "react";
import type {RefObject} from "react";
import {useFullscreen} from "@/shared/hooks/useFullscreen";
import {Tabs, TabsList, TabsTrigger} from "@/shared/components/ui/tabs.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {ProofTreeBuilder} from "@/features/proof-tree/components/proof-tree-builder/ProofTreeBuilder.tsx";
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
  const proof = useAppSelector((state) => state.term.proof);
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const {toTexTree, toLogicTree} = useProofHooks()
  const containerRef = useRef<HTMLDivElement>(null);
  const {isFullscreen, isPseudoFullscreen, toggle} = useFullscreen(containerRef);
  // Not Radix's <TabsContent> — mounting TransformWrapper inside it hung the tab.
  const [activeTab, setActiveTab] = useState<ProofTreeTab>("automatic");
  const [stepByStep, setStepByStep] = useState(false);
  const [highlightOnHover, setHighlightOnHover] = useState(true);

  const handleNodeHover = highlightOnHover
    ? (pos: SourcePosition | null) => editorRef?.current?.highlightRange?.(pos)
    : undefined;

  // Clear any lingering highlight when leaving the automatic tab, the switch is off,
  // or this panel unmounts — otherwise a stale highlight sticks in the text editor.
  useEffect(() => {
    const editor = editorRef?.current;
    return () => editor?.highlightRange?.(null);
  }, [activeTab, editorRef]);

  const hasProof = proof !== null && proof !== undefined;
  // Gate on the rules the proof actually uses, not on which extensions are toggled on — a plain
  // λ-term still has a clean Curry-Howard reading even with System F et al. enabled, and a term
  // that reaches for a non-STLC rule doesn't regardless.
  const showLogicTab = hasProof
    ? isPlainStlcProof(proof)
    : isPlainStlc(enabledTheories);
  const effectiveTab = activeTab === "logic" && !showLogicTab ? "automatic" : activeTab;

  const texTree = proof ? toTexTree(proof) : null;
  const logicTree = proof && showLogicTab ? toLogicTree(proof) : null;

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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProofTreeTab)}>
                <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
                  <TabsTrigger value="automatic">Automatic</TabsTrigger>
                  <TabsTrigger value="build-check">Build &amp; Check</TabsTrigger>
                  {showLogicTab ? (
                    <TabsTrigger value="logic">Curry–Howard correspondence</TabsTrigger>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <TabsTrigger value="logic" disabled>Logic</TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          {hasProof
                            ? "This term uses rules outside plain STLC, so it has no clean Curry-Howard reading"
                            : "Only available for plain STLC — turn off the active type system extensions to use it"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </TabsList>
              </Tabs>

              {effectiveTab === "automatic" && hasProof && (
                <div className="flex items-center gap-2">
                  <Switch id="step-by-step" checked={stepByStep} onCheckedChange={setStepByStep}/>
                  <Label htmlFor="step-by-step" className="text-sm text-muted-foreground whitespace-nowrap">
                    Step by step
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
                    Highlight in editor
                  </Label>
                </div>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggle}
              className="shrink-0"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
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
              <EmptyState icon={ListTree} message="Type a valid expression to generate a proof tree." />
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
                        {JSON.stringify(logicTree, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="h-full p-6">
                <EmptyState icon={Info} message="This proof uses rules outside plain STLC, so it has no clean Curry-Howard reading." />
              </div>
            )
          ) : (
            <div className="w-full h-full flex flex-col">
              {texTree && (
                <ProofTreeCanvas
                  texTree={texTree}
                  treeKey={proof?.id ?? "none"}
                  stepByStep={stepByStep}
                  exportFilename="proof-tree.tex"
                  onNodeHover={handleNodeHover}
                />
              )}
              {env.VITE_SHOW_DEBUG_DATA && (
                <details className="group mx-6 mb-6 mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                    <span className="inline-flex items-center gap-2">
                      View Raw Proof Data (DEBUG)
                    </span>
                  </summary>
                  <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                    <pre className="text-xs overflow-x-auto text-foreground/80">
                      {JSON.stringify(proof, null, 2)}
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
