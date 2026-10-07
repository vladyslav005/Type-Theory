import {useTranslation} from "react-i18next";
import {createPortal} from "react-dom";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {ArrowLeft, Crosshair, Download, Upload, ZoomIn, ZoomOut} from "lucide-react";
import {Separator} from "@/shared/components/ui/separator.tsx";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useEffect, useMemo, useRef} from "react";
import type {ChangeEvent} from "react";
import {toast} from "sonner";
import {exitBuildMode, loadManualProof, setManualDefinitions, setManualResults} from "@/shared/ui-state/termSlice.ts";
import {countManualNodes} from "@/shared/ui-state/manualProof.ts";
import {ExportLatexButtons} from "@/features/proof-tree/components/ExportLatexButtons.tsx";
import {TexRefExpansionProvider} from "@/features/proof-tree/components/proof-tree-using-css/TexRefExpansionContext.tsx";
import {manualNodeToExportTree} from "@/features/proof-tree/manual/manualToTex.ts";
import {downloadTextFile} from "@/shared/lib/downloadTextFile.ts";
import {parseManualProof, serializeManualProof} from "@/features/proof-tree/manual/manualFile.ts";
import {termKey} from "@/shared/lib/manualParse.ts";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {Button} from "@/shared/components/ui/button.tsx";
import {GuideDialog} from "@/shared/components/GuideDialog.tsx";
import {checkManualTree} from "@/features/proof-tree/manual/manualCheck.ts";
import {definitionName, parseDefinitions, setRequireTypeVariableTick} from "@/shared/lib/manualParse.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import {JUDGEMENT_LANGUAGE_ID, setJudgementNames} from "@/features/editor/hooks/judgementLanguage.ts";
import {ManualNodeView} from "@/features/proof-tree/manual/ManualNodeView.tsx";
import {failingDefinitions} from "@/features/proof-tree/manual/definitionUses.ts";
import {Tip} from "@/shared/components/Tip.tsx";
import {usePracticeSession} from "@/shared/activity/practiceSession.ts";

const GUIDE_STEPS = ["root", "premises", "sideConditions", "notation", "definitions", "constraints", "check", "save"];

export function ManualBuilder({toolbarTarget}: {toolbarTarget?: HTMLElement | null}) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {manualTree, manualResults, manualDefinitions, answerKey} = useAppSelector((state) => state.term.buildMode);
  const theories = useAppSelector((state) => state.term.enabledTheories);
  const usesConstraints = theories.letPolymorphism || theories.typeInference;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsedDefinitions = useMemo(() => {
    setRequireTypeVariableTick(usesConstraints);
    return parseDefinitions(manualDefinitions ?? "");
  }, [manualDefinitions, usesConstraints]);

  useEffect(() => {
    const {contexts, constraints} = parsedDefinitions.definitions;
    const termNames = answerKey ? termKey(answerKey.term).match(/[A-Za-z_]\w*/g) ?? [] : [];
    setJudgementNames([
      ...[...contexts.keys()].map((k) => definitionName("Γ", k)),
      ...[...constraints.keys()].map((k) => definitionName("C", k)),
      ...termNames,
    ]);
  }, [parsedDefinitions, answerKey]);

  const session = usePracticeSession("proofManual", answerKey ? termKey(answerKey.term) : "");
  const manualResultsList = Object.values(manualResults ?? {});
  const manualComplete = manualResultsList.length > 0 && manualResultsList.every((r) => !Object.values(r).some((v) => v === "invalid"));
  const recordedComplete = useRef(false);
  useEffect(() => {
    if (!manualComplete || recordedComplete.current) return;
    recordedComplete.current = true;
    session.update((entry) => ({...entry, finished: true, allCorrect: true}));
  }, [manualComplete, session]);

  const failing = manualTree && manualResults ? failingDefinitions(manualDefinitions ?? "", manualTree, manualResults) : [];
  const definitionMarkers = [
    ...parsedDefinitions.errors.map((e) => ({line: e.line, severity: "error" as const, message: e.message})),
    ...failing.map((f) => ({line: f.line, severity: "warning" as const, message: t("manualBuilder.definitionAllUsesWrong", {line: f.line, name: f.name})})),
  ];

  if (!manualTree || !answerKey) return null;

  const results = manualResults ?? {};
  const checked = Object.keys(results).length > 0;
  const nodeResults = Object.values(results);
  const invalid = nodeResults.filter((r) => Object.values(r).some((v) => v === "invalid")).length;

  const download = () => {
    downloadTextFile(
      "proof-tree-manual.json",
      serializeManualProof({term: termKey(answerKey.term), tree: manualTree, definitions: manualDefinitions ?? ""}),
      "application/json",
    );
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const loaded = parseManualProof(await file.text());
      if (loaded.term !== termKey(answerKey.term)) {
        toast.error(t("manualBuilder.toastWrongTerm"));
        return;
      }
      dispatch(loadManualProof({tree: loaded.tree, definitions: loaded.definitions}));
      toast.success(t("manualBuilder.toastLoaded"));
    } catch (err) {
      console.error("Failed to load manual proof", err);
      toast.error(t("manualBuilder.toastInvalidFile"));
    }
  };

  const check = () => {
    session.update((entry) => ({...entry, checks: entry.checks + 1}));
    dispatch(setManualResults(checkManualTree(manualTree, answerKey, usesConstraints, parsedDefinitions.definitions)));
  };

  const toolbar = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <Button size="sm" variant="ghost" className="gap-1.5 shrink-0 text-muted-foreground" onClick={() => dispatch(exitBuildMode())}>
          <ArrowLeft className="h-3.5 w-3.5"/>
          {t("proofBuilder.exit")}
        </Button>
        <Separator orientation="vertical" className="h-5"/>
        <p className="text-sm text-muted-foreground">
          {t("manualBuilder.summary", {count: countManualNodes(manualTree)})}
          {checked && (
            <>
              {" — "}
              <span className={invalid === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                {invalid === 0 ? t("manualBuilder.allValid") : t("manualBuilder.nodesWithMistakes", {count: invalid})}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={download}>
                <Download className="h-3.5 w-3.5"/>
                {t("manualBuilder.btnDownloadJson")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("manualBuilder.downloadJson")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5"/>
                {t("manualBuilder.btnUploadJson")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("manualBuilder.uploadJson")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={upload}/>
        <GuideDialog i18nPrefix="manualBuilder.guide" steps={usesConstraints ? GUIDE_STEPS : GUIDE_STEPS.filter((step) => step !== "constraints")}/>
        <Button size="sm" onClick={check}>{t("proofBuilder.checkProof")}</Button>
        {checked && (
          <Button size="sm" variant="outline" onClick={() => dispatch(setManualResults({}))}>{t("manualBuilder.clearMarks")}</Button>
        )}
      </div>
    </>
  );

  return (
    <div className="w-full h-full flex flex-col space-y-4" {...session.activityProps}>
      {toolbarTarget
        ? createPortal(<div className="flex flex-wrap items-center gap-2">{toolbar}</div>, toolbarTarget)
        : <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-b-xl bg-muted/30 border">{toolbar}</div>}

      <details open className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {t("manualBuilder.definitions")}
          {(manualDefinitions ?? "").trim() && ` (${(manualDefinitions ?? "").split("\n").filter((l) => l.trim()).length})`}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{t(usesConstraints ? "manualBuilder.definitionsHint" : "manualBuilder.definitionsHintNoConstraints")}</p>
        <div className="mt-2">
          <LabEditor
            language={JUDGEMENT_LANGUAGE_ID}
            suggestWhileTyping
            value={manualDefinitions ?? ""}
            onChange={(next) => dispatch(setManualDefinitions(next))}
            markers={definitionMarkers}
            placeholder={usesConstraints ? "Γ_1 = {x : 'A}   C_1 = {'A → 'A = Nat → 'B}" : "Γ_1 = {x : A}"}
            className="w-full"
          />
        </div>
        {parsedDefinitions.errors.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[11px] text-destructive">
            {parsedDefinitions.errors.map((e, i) => (
              <li key={i}>{t("manualBuilder.definitionError", {line: e.line, message: e.message})}</li>
            ))}
          </ul>
        )}
        {failing.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            {failing.map((f) => (
              <li key={f.line}>{t("manualBuilder.definitionAllUsesWrong", {line: f.line, name: f.name})}</li>
            ))}
          </ul>
        )}
      </details>

      <div className="flex-1 w-full relative rounded-xl bg-muted/30 border overflow-hidden">
        <TransformWrapper
          initialScale={1}
          minScale={0.1}
          maxScale={3}
          centerOnInit={true}
          wheel={{step: 0.1, excluded: ["input", "monaco-editor"]}}
          doubleClick={{mode: "zoomIn", excluded: ["input", "button", "manual-readonly", "monaco-editor"]}}
          panning={{velocityDisabled: true, excluded: ["input", "button", "manual-readonly", "monaco-editor"]}}
          limitToBounds={false}
        >
          {({zoomIn, zoomOut, centerView}) => (
            <TexRefExpansionProvider key={answerKey.id ?? "none"}>
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <ExportLatexButtons
                  buildTree={() => manualNodeToExportTree(manualTree, results, usesConstraints)}
                  filename="proof-tree-manual.tex"
                />
                <Tip label={t("proofTreeCanvas.zoomIn")}>
                  <Button size="icon" variant="secondary" onClick={() => zoomIn()}>
                    <ZoomIn className="h-4 w-4"/>
                  </Button>
                </Tip>
                <Tip label={t("proofTreeCanvas.zoomOut")}>
                  <Button size="icon" variant="secondary" onClick={() => zoomOut()}>
                    <ZoomOut className="h-4 w-4"/>
                  </Button>
                </Tip>
                <Tip label={t("proofTreeCanvas.centerView")}>
                  <Button size="icon" variant="secondary" onClick={() => centerView()}>
                    <Crosshair className="h-4 w-4"/>
                  </Button>
                </Tip>
              </div>
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full !flex !items-center !justify-center"
                wrapperStyle={{width: "100%", height: "100%", overflow: "hidden"}}
              >
                <div className="flex items-center justify-center p-6">
                  <ManualNodeView node={manualTree} results={results} usesConstraints={usesConstraints}/>
                </div>
              </TransformComponent>
            </TexRefExpansionProvider>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
