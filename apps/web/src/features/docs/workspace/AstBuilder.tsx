import {useTranslation} from "react-i18next";
import {useCallback, useRef, useState} from "react";
import {Lightbulb} from "lucide-react";
import {ReactFlowProvider} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {Program} from "@vladyslav005/tt-core";
import type {AstFlowGraph} from "@/shared/presentation/flow/types.ts";
import {AstEditor, type AstEditorHandle} from "@/features/ast/components/ast-editor/AstEditor.tsx";
import {AstNodePaletteDropdowns} from "@/features/ast/components/ast-editor/AstNodePaletteDropdowns.tsx";
import {astToText} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {ButtonGroup} from "@/shared/components/ui/button-group.tsx";

function emptyState(): {ast: Program; graph: AstFlowGraph} {
  const ast: Program = {id: `program-${Date.now()}`, kind: "Program", globals: []};
  return {
    ast,
    graph: {nodes: [{id: "origin", type: "program", position: {x: 0, y: 0}, data: {term: ast}}], edges: []},
  };
}

interface AstBuilderProps {
  label?: string;
  instructions?: string;
  allowedTypes?: string[];
}

// Standalone, Redux-free instance of the main app's AST editor.
export function AstBuilder({label, instructions, allowedTypes}: AstBuilderProps) {
  const {t} = useTranslation();
  const astEditorRef = useRef<AstEditorHandle>(null);

  const [{ast, graph}, setState] = useState(emptyState);

  const setAst = useCallback((next: Program) => setState((prev) => ({...prev, ast: next})), []);
  const setGraph = useCallback(
    (updater: AstFlowGraph | ((prev: AstFlowGraph) => AstFlowGraph)) =>
      setState((prev) => ({...prev, graph: typeof updater === "function" ? updater(prev.graph) : updater})),
    [],
  );

  const reset = () => setState(emptyState());

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label ?? t("lectureWidgets.buildYourself")}</p>
          {instructions && <p className="text-xs text-muted-foreground mt-1 max-w-xl">{instructions}</p>}
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium mt-1.5">
            <Lightbulb className="h-3.5 w-3.5 shrink-0"/>
            {t("lectureWidgets.astTip")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <AstNodePaletteDropdowns
              onInsert={(type) => astEditorRef.current?.addStandaloneNode(type)}
              allowedTypes={allowedTypes}
            />
          </ButtonGroup>
          <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.reset")}</Button>
        </div>
      </div>

      <div className="h-80 rounded-md border overflow-hidden bg-background">
        <ReactFlowProvider>
          <AstEditor ref={astEditorRef} graph={graph} setGraph={setGraph} AST={ast} setAST={setAst}/>
        </ReactFlowProvider>
      </div>

      <p className="font-mono text-sm rounded-md border bg-background p-3 overflow-x-auto min-h-[2.5rem]">
        {ast.globals.length === 0 && !ast.term ? (
          <span className="text-muted-foreground">{t("lectureWidgets.astEmpty")}</span>
        ) : (
          astToText(ast)
        )}
      </p>
    </div>
  );
}
