import {useEffect, useState} from "react";
import {useViewTime} from "@/shared/activity/activityClock.ts";
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
import {LazyAstVisualisation} from "@/features/ast/components/LazyAstVisualisation.tsx";
import {RunButton} from "@/features/editor/components/RunButton.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setTermText, severityOf} from "@/shared/ui-state/termSlice.ts";
import {registerPanelOpener} from "@/shared/ui-state/outputPanel.ts";

type PrimaryTab = "editor" | "errors" | "results";
type ResultView = "proofTree" | "evaluation" | "ast";

const resultViewOptions: {value: ResultView; labelKey: string}[] = [
  {value: "proofTree", labelKey: "panels.proofTree"},
  {value: "evaluation", labelKey: "panels.evaluation"},
  {value: "ast", labelKey: "panels.ast"},
];

const MOBILE_EDITOR_OPTIONS = {
  minimap: {enabled: false},
  wordWrap: "on",
  folding: false,
  lineNumbersMinChars: 2,
};

export interface MobileWorkspaceLayoutProps {
  className?: string;
}

function ViewTime({view}: {view: string}) {
  useViewTime(view);
  return null;
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
  const problemCount = errors?.filter((e) => severityOf(e) !== "info").length ?? 0;

  useEffect(() => registerPanelOpener((panel) => {
    if (panel === "editor") setPrimaryTab("editor");
    else if (panel === "errorOutput") setPrimaryTab("errors");
    else {
      setPrimaryTab("results");
      setResultView(panel);
    }
  }), []);

  return (
    <div className={className ? `${className} flex flex-col` : "flex flex-col"}>
      <Tabs value={primaryTab} onValueChange={(v) => setPrimaryTab(v as PrimaryTab)} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full h-11 shrink-0">
          <TabsTrigger value="editor" className="flex-1 h-full" data-tour="tab-editor">{t("panels.editor")}</TabsTrigger>
          <TabsTrigger value="errors" className="flex-1 h-full" data-tour="tab-errorOutput">
            {t("panels.errors")}{problemCount > 0 ? ` (${problemCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1 h-full" data-tour={primaryTab === "results" ? "tab-results" : "tab-results tab-proofTree tab-evaluation tab-ast"}>{t("panels.results")}</TabsTrigger>
        </TabsList>

        <div
          className="flex-1 min-h-0 mt-2"
          data-tour={primaryTab === "editor" ? "panel-editor" : primaryTab === "errors" ? "panel-errorOutput" : `panel-${resultView}`}
        >
          {primaryTab === "editor" && (
            <TextEditor
              ref={editorRef}
              className="h-full"
              defaultValue={termText ?? "a : T; (λ x : T . (x) ) a;"}
              height="100%"
              language="lambda"
              readOnly={buildModeActive}
              hideActions
              options={MOBILE_EDITOR_OPTIONS}
              onChange={(value) => dispatch(setTermText(value))}
            />
          )}

          {primaryTab === "editor" && <ViewTime view="editor"/>}
          {primaryTab === "errors" && <ViewTime view="errors"/>}
          {primaryTab === "results" && resultView === "ast" && <ViewTime view="ast"/>}
          {primaryTab === "errors" && (
            <div className="h-full overflow-auto [&>*]:!transform-none">
              <ErrorOutput className="h-full" editorRef={editorRef}/>
            </div>
          )}

          {primaryTab === "results" && (
            <div className="h-full flex flex-col gap-2 min-h-0">
              <Select value={resultView} onValueChange={(v) => setResultView(v as ResultView)}>
                <SelectTrigger className="w-full shrink-0" data-tour="tab-proofTree tab-evaluation tab-ast">
                  <SelectValue/>
                </SelectTrigger>
                <SelectContent>
                  {resultViewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* The panels' fade-in slide would briefly overflow and flash a scrollbar here */}
              <div className="flex-1 min-h-0 overflow-auto [&>*]:!transform-none">
                {resultView === "proofTree" && (
                  <ProofTreeVisualisation className="h-full" editorRef={editorRef}/>
                )}
                {resultView === "evaluation" && (
                  <EvaluationVisualisation className="h-full"/>
                )}
                {resultView === "ast" && (
                  <LazyAstVisualisation className="h-full" editorRef={editorRef}/>
                )}
              </div>
            </div>
          )}
        </div>
      </Tabs>

      {/* Sticky primary-action bar — always the bottom row of this flex column, so it stays
          reachable without floating above content or fighting the viewport's dvh chrome. */}
      <div className="shrink-0 mt-2 flex items-stretch gap-2">
        <RunButton className="flex-1 min-w-0 [&>[data-run]]:flex-1 [&>[data-run]]:min-w-0 [&>[data-run]]:justify-center [&>[data-run]]:whitespace-normal [&>[data-run]]:flex-wrap [&>[data-run]]:gap-x-2 [&>[data-run]]:gap-y-0 [&>[data-run]]:text-center [&>[data-run]]:leading-tight [&>[data-run]]:py-2 [&>[data-run]]:h-auto [&>[data-run]]:min-h-9"/>
      </div>
    </div>
  );
}
