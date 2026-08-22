import {useEffect, useRef, useState} from "react";
import type {ChangeEvent} from "react";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {cn} from "@/shared/lib/utils.ts";
import {Card, CardContent, CardHeader} from "@/shared/components/ui/card.tsx";
import {motion} from "framer-motion";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Maximize2, Minimize2, Copy, ClipboardPaste, Download, Upload, Network} from "lucide-react";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {Ast} from "@/features/ast/components/ast/Ast.tsx";
import {AstEditor, type AstEditorHandle} from "@/features/ast/components/ast-editor/AstEditor.tsx";
import {AstNodePaletteDropdowns} from "@/features/ast/components/ast-editor/AstNodePaletteDropdowns.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {ButtonGroup, ButtonGroupSeparator} from "@/shared/components/ui/button-group.tsx";
import {Tabs, TabsList, TabsTrigger} from "@/shared/components/ui/tabs.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {useFullscreen} from "@/shared/hooks/useFullscreen";
import {Switch} from "@/shared/components/ui/switch.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import type {Program} from "@vladyslav005/tt-core";
import type {RefObject} from "react";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {astToText} from "@vladyslav005/tt-core";
import type {AstFlowGraph} from "@/shared/presentation/flow/types.ts";
import {useMapAstToFlow} from "@/features/ast/hooks/mapAstToFlow.ts";
import {layoutAstFlow} from "@/features/ast/hooks/layoutAstFlow.ts";
import {ReactFlowProvider} from "@xyflow/react";
import {env} from "@/shared/lib/env.ts";
import {downloadTextFile} from "@/shared/lib/downloadTextFile.ts";
import {toast} from "sonner";

export interface AstVisualisationProps {
  className?: string;
  editorRef?: RefObject<TextEditorHandle | null>;
}

type AstTab = "viewer" | "editor";

export function AstVisualisation({
                                   className,
                                   editorRef,
                                 }: AstVisualisationProps) {
  const viewerAst = useAppSelector((state) => state.term.ast);
  const hasViewerAst = viewerAst !== null && viewerAst !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const astEditorRef = useRef<AstEditorHandle>(null);
  const {isFullscreen, isPseudoFullscreen, toggle} = useFullscreen(containerRef);
  const [activeTab, setActiveTab] = useState<AstTab>("viewer");
  const [highlightOnHover, setHighlightOnHover] = useState(true);

  // Clear any lingering highlight when leaving the viewer tab or this panel unmounts —
  // otherwise a stale highlight sticks in the text editor.
  useEffect(() => {
    const editor = editorRef?.current;
    return () => editor?.highlightRange?.(null);
  }, [activeTab, editorRef]);

  const [editorAst, setEditorAst] = useState<Program>({
    id: "program-initial",
    kind: "Program",
    globals: [],
  });
  const {mapAstToFlow} = useMapAstToFlow();
  const [graph, setGraph] = useState<AstFlowGraph>({
    nodes: [{id: "origin", type: "program", position: {x: 0, y: 0}, data: {term: editorAst}}],
    edges: [],
  });

  const copyAstText = async () => {
    try {
      await navigator.clipboard.writeText(astToText(editorAst));
    } catch (e) {
      console.error("Failed to copy AST text", e);
    }
  };

  const pasteAstToEditor = () => {
    try {
      editorRef?.current?.setValue(astToText(editorAst));
    } catch (e) {
      console.error("Failed to paste AST into editor", e);
    }
  };

  const copyFromViewer = () => {
    if (!viewerAst) return;
    setEditorAst(viewerAst);
    const newGraph = mapAstToFlow(viewerAst);
    newGraph.nodes.forEach((node) => {node.data.editable = true;});
    setGraph(layoutAstFlow(newGraph.nodes, newGraph.edges));
  };

  const loadEditorAst = (program: Program) => {
    setEditorAst(program);
    const newGraph = mapAstToFlow(program);
    newGraph.nodes.forEach((node) => {node.data.editable = true;});
    setGraph(layoutAstFlow(newGraph.nodes, newGraph.edges));
  };

  const downloadEditorAst = () => {
    downloadTextFile("ast.json", JSON.stringify(editorAst, null, 2), "application/json");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadEditorAst = () => fileInputRef.current?.click();

  const handleAstFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.kind !== "Program" || !Array.isArray(parsed.globals)) {
        throw new Error("Not a Program AST");
      }
      loadEditorAst(parsed as Program);
      toast.success("AST loaded from file");
    } catch (err) {
      console.error("Failed to load AST JSON", err);
      toast.error("Invalid AST JSON file");
    }
  };

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto min-w-0 flex-1">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AstTab)}>
                <TabsList className="shrink-0">
                  <TabsTrigger value="viewer">Viewer</TabsTrigger>
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab === "viewer" && hasViewerAst && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="ast-highlight-on-hover"
                    checked={highlightOnHover}
                    onCheckedChange={(checked) => {
                      setHighlightOnHover(checked);
                      if (!checked) editorRef?.current?.highlightRange?.(null);
                    }}
                  />
                  <Label htmlFor="ast-highlight-on-hover" className="text-sm text-muted-foreground whitespace-nowrap">
                    Highlight in editor
                  </Label>
                </div>
              )}

              {activeTab === "editor" && (
                <TooltipProvider>
                  <div className="flex items-center gap-3">
                    <ButtonGroup>
                      <AstNodePaletteDropdowns onInsert={(type) => astEditorRef.current?.addStandaloneNode(type)}/>
                    </ButtonGroup>

                    <ButtonGroupSeparator className="h-6" />

                    <ButtonGroup>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyAstText}>
                            <Copy className="h-3.5 w-3.5" />
                            Copy text
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Copy the edited AST as lambda calculus source text</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyFromViewer} disabled={!viewerAst}>
                            <Download className="h-3.5 w-3.5" />
                            Copy from viewer
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Load the Viewer tab's current AST in here for editing</TooltipContent>
                      </Tooltip>
                    </ButtonGroup>

                    <ButtonGroupSeparator className="h-6" />

                    <ButtonGroup>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadEditorAst}>
                            <Download className="h-3.5 w-3.5" />
                            Download JSON
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Download the edited AST as a JSON file</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={uploadEditorAst}>
                            <Upload className="h-3.5 w-3.5" />
                            Upload JSON
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Load an AST from a JSON file</TooltipContent>
                      </Tooltip>
                    </ButtonGroup>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={handleAstFileSelected}
                    />

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={pasteAstToEditor} disabled={!editorRef}>
                          <ClipboardPaste className="h-3.5 w-3.5" />
                          Paste to text editor
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Write the edited AST's source text into the text editor above</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
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
        <CardContent className="flex-1 overflow-hidden p-0">
          {activeTab === "viewer" ? (
            hasViewerAst ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 rounded-b-xl border overflow-hidden bg-muted/30">
                  <Ast AST={viewerAst} editorRef={editorRef} highlightOnHover={highlightOnHover}/>
                </div>
                {env.VITE_SHOW_DEBUG_DATA && (
                  <details className="group mx-6 mb-6 mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                      <span className="inline-flex items-center gap-2">
                        View Raw AST Data (DEBUG)
                      </span>
                    </summary>
                    <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                      <pre className="text-xs overflow-x-auto text-foreground/80">
                        {JSON.stringify(viewerAst, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <div className="h-full p-6">
                <EmptyState icon={Network} message="Type a valid expression to generate an AST." />
              </div>
            )
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 rounded-b-xl border overflow-hidden bg-muted/30">
                <ReactFlowProvider>
                  <AstEditor ref={astEditorRef} graph={graph} setGraph={setGraph} AST={editorAst} setAST={setEditorAst}/>
                </ReactFlowProvider>
              </div>
              {env.VITE_SHOW_DEBUG_DATA && (
                <details className="group mx-6 mb-6 mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors p-3 rounded-lg hover:bg-muted/50">
                    <span className="inline-flex items-center gap-2">
                      View Raw AST Data (DEBUG)
                    </span>
                  </summary>
                  <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
                    <pre className="text-xs overflow-x-auto text-foreground/80">
                      {JSON.stringify(editorAst, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
