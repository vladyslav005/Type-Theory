import {useTranslation} from "react-i18next";
import {useCallback, useMemo, useRef, useState} from "react";
import {trackTask, trackWidgetUse, useTaskId} from "@/shared/activity/taskTracking.ts";
import {Info, Plus} from "lucide-react";
import {Tip} from "@/shared/components/Tip.tsx";
import {ReactFlowProvider} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {Program, Term} from "@vladyslav005/tt-core";
import type {AstFlowGraph} from "@/shared/presentation/flow/types.ts";
import {AstEditor, type AstEditorHandle} from "@/features/ast/components/ast-editor/AstEditor.tsx";
import {AstNodePaletteDropdowns} from "@/features/ast/components/ast-editor/AstNodePaletteDropdowns.tsx";
import {AntlrParserAdapter, astToText} from "@vladyslav005/tt-core";
import {Button} from "@/shared/components/ui/button.tsx";
import {ButtonGroup} from "@/shared/components/ui/button-group.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {checkAst, type AstCheck} from "@/features/docs/workspace/astCheck.ts";

const DECLARATION_TYPES = ["funDecl", "varDecl", "typeAliasDecl", "typeConstructorDecl"];

// Without declarations there is no Program node: the first node added is the term's root.
function emptyState(termOnly: boolean): {ast: Program; graph: AstFlowGraph} {
  const ast: Program = {id: `program-${Date.now()}`, kind: "Program", globals: []};
  return {
    ast,
    graph: termOnly
      ? {nodes: [], edges: []}
      : {nodes: [{id: "origin", type: "program", position: {x: 0, y: 0}, data: {term: ast}}], edges: []},
  };
}

interface AstBuilderProps {
  // Stable task id for activity tracking; needed whenever the builder checks an answer on its own.
  id?: string;
  label?: string;
  instructions?: string;
  allowedTypes?: string[];
  // With an expected term the builder gets a Check button that marks every node right or wrong.
  expected?: Term;
  // The same as `expected`, written as source text — convenient from MDX.
  expectedSource?: string;
  onCheck?: (result: AstCheck) => void;
  // Tighter layout for lab rows.
  compact?: boolean;
}

const programKey = (ast: Program) => (ast.term ? astToText(ast) : "");

// Standalone, Redux-free instance of the main app's AST editor.
const sourceParser = new AntlrParserAdapter();

export function AstBuilder({id, label, instructions, allowedTypes, expected: expectedTerm, expectedSource, onCheck, compact = false}: AstBuilderProps) {
  const {t} = useTranslation();
  const expected = useMemo(
    () => expectedTerm ?? (expectedSource ? sourceParser.parseExpression(`${expectedSource.replace(/;\s*$/, "")};`).term : undefined),
    [expectedTerm, expectedSource],
  );
  const astEditorRef = useRef<AstEditorHandle>(null);
  const taskId = useTaskId(expectedSource && !onCheck ? id : undefined);

  const termOnly = !!allowedTypes && !allowedTypes.some((type) => DECLARATION_TYPES.includes(type));
  const [{ast, graph}, setState] = useState(() => emptyState(termOnly));
  const [check, setCheck] = useState<{result: AstCheck; key: string} | undefined>();

  // Marks belong to the tree that was checked — any structural change clears them.
  const setAst = useCallback((next: Program) => {
    setState((prev) => ({...prev, ast: next}));
    setCheck((current) => (current && current.key !== programKey(next) ? undefined : current));
  }, []);
  const setGraph = useCallback(
    (updater: AstFlowGraph | ((prev: AstFlowGraph) => AstFlowGraph)) =>
      setState((prev) => ({...prev, graph: typeof updater === "function" ? updater(prev.graph) : updater})),
    [],
  );

  const markedGraph = useMemo<AstFlowGraph>(() => ({
    ...graph,
    nodes: graph.nodes.map((node) => {
      const verdict = check?.result.verdicts[node.id];
      return {...node, className: verdict ? `ast-check-${verdict}` : undefined};
    }),
  }), [graph, check]);

  const reset = () => {
    setState(emptyState(termOnly));
    setCheck(undefined);
  };

  const runCheck = () => {
    if (!expected) return;
    const result = checkAst(ast, graph, expected);
    setCheck({result, key: programKey(ast)});
    if (onCheck) onCheck(result);
    else if (taskId) trackTask(taskId, {ok: result.correct, kind: result.correct ? undefined : result.wrong > 0 ? "wrongNode" : result.missing > 0 ? "treeIncomplete" : "looseNode"});
  };

  const result = check?.result;
  const problems = result && [
    result.wrong > 0 && t("lectureWidgets.astCheck.wrong", {count: result.wrong}),
    result.missing > 0 && t("lectureWidgets.astCheck.missing", {count: result.missing}),
    result.loose > 0 && t("lectureWidgets.astCheck.loose", {count: result.loose}),
  ].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-3 print:hidden", compact ? "" : "rounded-xl border bg-muted/20 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {compact ? <span/> : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label ?? t("lectureWidgets.buildYourself")}</p>
            {instructions && <p className="text-xs text-muted-foreground mt-1 max-w-xl">{instructions}</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* How-to hints live in a tooltip so the task stays uncluttered. */}
          <Tip label={[compact ? instructions : undefined, t("lectureWidgets.astTip")].filter(Boolean).join(" ")}>
            <span className="text-muted-foreground hover:text-foreground" aria-label={t("lectureWidgets.astHelp")}>
              <Info className="h-4 w-4"/>
            </span>
          </Tip>
          <ButtonGroup>
            <AstNodePaletteDropdowns
              onInsert={(type) => { trackWidgetUse("astBuilder"); astEditorRef.current?.addStandaloneNode(type); }}
              allowedTypes={allowedTypes}
            />
          </ButtonGroup>
          {expected && <Button size="sm" onClick={runCheck}>{t("labWidgets.check")}</Button>}
          {check && <Button size="sm" variant="outline" onClick={() => setCheck(undefined)}>{t("manualBuilder.clearMarks")}</Button>}
          <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.reset")}</Button>
        </div>
      </div>

      <div className={cn("relative rounded-md border overflow-hidden bg-background", compact ? "h-72" : "h-80")}>
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-background/90 px-5 py-4 text-center">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Plus className="h-4 w-4"/>
                {t("lectureWidgets.astAddFirst")}
              </span>
              <ButtonGroup>
                <AstNodePaletteDropdowns
                  onInsert={(type) => { trackWidgetUse("astBuilder"); astEditorRef.current?.addStandaloneNode(type); }}
                  allowedTypes={allowedTypes}
                />
              </ButtonGroup>
            </div>
          </div>
        )}
        <ReactFlowProvider>
          <AstEditor ref={astEditorRef} graph={markedGraph} setGraph={setGraph} AST={ast} setAST={setAst} allowedTypes={allowedTypes} compactToolbar/>
        </ReactFlowProvider>
      </div>

      {result && (
        <p className={cn("text-xs", result.correct ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
          {result.correct ? t("lectureWidgets.astCheck.correct") : problems}
        </p>
      )}

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
