import {useState} from "react";
import {useTranslation} from "react-i18next";
import {useOutletContext} from "react-router-dom";
import type {AppOutletContext} from "@/app/layout/AppLayout.tsx";
import {Tabs, TabsList, TabsTrigger} from "@/shared/components/ui/tabs.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select.tsx";
import {TextEditor} from "@/features/editor/components/TextEditor.tsx";
import {ErrorOutput} from "@/features/error-output/components/ErrorOutput.tsx";
import {EvaluationVisualisation} from "@/features/evaluation/components/EvaluationVisualisation.tsx";
import {ProofTreeVisualisation} from "@/features/proof-tree/components/ProofTreeVisualisation.tsx";
import {AstVisualisation} from "@/features/ast/components/AstVisualisation.tsx";
import {TypeCheckButton} from "@/features/editor/components/TypeCheckButton.tsx";
import {EvaluateButton} from "@/features/editor/components/EvaluateButton.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setTermText} from "@/shared/ui-state/termSlice.ts";

type PrimaryTab = "editor" | "errors" | "results";
type ResultView = "proofTree" | "evaluation" | "ast";

const resultViewOptions: {value: ResultView; labelKey: string}[] = [
  {value: "proofTree", labelKey: "panels.proofTree"},
  {value: "evaluation", labelKey: "panels.evaluation"},
  {value: "ast", labelKey: "panels.ast"},
];

export interface MobileWorkspaceLayoutProps {
  className?: string;
}

// Single-column, tab-switched stand-in for the dockview workbench used on wider
// screens — dockview's freeform panel grid has no sensible single-pane rendering,
// so narrow viewports get this dedicated layout instead of a squeezed dockview grid.
export function MobileWorkspaceLayout({className}: MobileWorkspaceLayoutProps) {
  const {t} = useTranslation();
  const {editorRef} = useOutletContext<AppOutletContext>();
  const dispatch = useAppDispatch();
  const buildModeActive = useAppSelector((state) => state.term.buildMode.active);
  const termText = useAppSelector((state) => state.term.termText);
  const errors = useAppSelector((state) => state.term.processingErrors);

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("editor");
  const [resultView, setResultView] = useState<ResultView>("proofTree");

  return (
    <div className={className ? `${className} flex flex-col` : "flex flex-col"}>
      <Tabs value={primaryTab} onValueChange={(v) => setPrimaryTab(v as PrimaryTab)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full h-11 shrink-0">
          <TabsTrigger value="editor" className="flex-1 h-full">{t("panels.editor")}</TabsTrigger>
          <TabsTrigger value="errors" className="flex-1 h-full">
            {t("panels.errors")}{errors && errors.length > 0 ? ` (${errors.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1 h-full">{t("panels.results")}</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 mt-2">
          {primaryTab === "editor" && (
            <TextEditor
              ref={editorRef}
              className="h-full"
              defaultValue={termText ?? "a : T; (λ x : T . (x) ) a;"}
              height="100%"
              language="lambda"
              readOnly={buildModeActive}
              hideActions
              onChange={(value) => dispatch(setTermText(value))}
            />
          )}

          {primaryTab === "errors" && (
            <div className="h-full overflow-auto">
              <ErrorOutput className="h-full"/>
            </div>
          )}

          {primaryTab === "results" && (
            <div className="h-full flex flex-col gap-2 min-h-0">
              <Select value={resultView} onValueChange={(v) => setResultView(v as ResultView)}>
                <SelectTrigger className="w-full shrink-0">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {resultViewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex-1 min-h-0 overflow-auto">
                {resultView === "proofTree" && (
                  <ProofTreeVisualisation className="h-full" editorRef={editorRef}/>
                )}
                {resultView === "evaluation" && (
                  <EvaluationVisualisation className="h-full"/>
                )}
                {resultView === "ast" && (
                  <AstVisualisation className="h-full" editorRef={editorRef}/>
                )}
              </div>
            </div>
          )}
        </div>
      </Tabs>

      {/* Sticky primary-action bar — always the bottom row of this flex column, so it stays
          reachable without floating above content or fighting the viewport's dvh chrome. */}
      <div className="shrink-0 mt-2 flex items-stretch gap-2 [&>*]:flex-1 [&>*]:min-w-0">
        <TypeCheckButton className="justify-center whitespace-normal text-center leading-tight py-2 h-auto min-h-9"/>
        <EvaluateButton className="min-w-0 [&>button:first-child]:flex-1 [&>button:first-child]:min-w-0 [&>button:first-child]:justify-center [&>button:first-child]:whitespace-normal [&>button:first-child]:text-center [&>button:first-child]:leading-tight [&>button:first-child]:py-2 [&>button:first-child]:h-auto [&>button:first-child]:min-h-9"/>
      </div>
    </div>
  );
}
