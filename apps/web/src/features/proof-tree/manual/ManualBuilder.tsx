import {useTranslation} from "react-i18next";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {Crosshair, Download, Upload, ZoomIn, ZoomOut} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useMemo, useRef} from "react";
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
import {checkManualTree} from "@/features/proof-tree/manual/manualCheck.ts";
import {parseDefinitions, setRequireTypeVariableTick} from "@/shared/lib/manualParse.ts";
import {applyShortcuts} from "@/features/proof-tree/manual/notation.ts";
import {BracketTextarea} from "@/shared/components/BracketTextarea.tsx";
import {useUndoableText} from "@/shared/hooks/useUndoableText.ts";
import {ManualNodeView} from "@/features/proof-tree/manual/ManualNodeView.tsx";

export function ManualBuilder() {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const {manualTree, manualResults, manualDefinitions, answerKey} = useAppSelector((state) => state.term.buildMode);
  const theories = useAppSelector((state) => state.term.enabledTheories);
  const usesConstraints = theories.letPolymorphism || theories.typeInference;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const definitionsHistory = useUndoableText(manualDefinitions ?? "", (next) => dispatch(setManualDefinitions(next)));
  const parsedDefinitions = useMemo(() => {
    setRequireTypeVariableTick(usesConstraints);
    return parseDefinitions(manualDefinitions ?? "");
  }, [manualDefinitions, usesConstraints]);

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

  const check = () => dispatch(setManualResults(checkManualTree(manualTree, answerKey, usesConstraints, parsedDefinitions.definitions)));

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-b-xl bg-muted/30 border">
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
          <Button size="sm" onClick={check}>{t("proofBuilder.checkProof")}</Button>
          {checked && (
            <Button size="sm" variant="outline" onClick={() => dispatch(setManualResults({}))}>{t("manualBuilder.clearMarks")}</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => dispatch(exitBuildMode())}>{t("proofBuilder.exit")}</Button>
        </div>
      </div>

      <details open className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {t("manualBuilder.definitions")}
          {(manualDefinitions ?? "").trim() && ` (${(manualDefinitions ?? "").split("\n").filter((l) => l.trim()).length})`}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{t("manualBuilder.definitionsHint")}</p>
        <div className="mt-2">
          <BracketTextarea
            value={manualDefinitions ?? ""}
            onChange={(e) => definitionsHistory.change(applyShortcuts(e.target.value))}
            onKeyDown={definitionsHistory.onKeyDown}
            minRows={3}
            spellCheck={false}
            placeholder={"Γ_1 = {x : 'A}\nC_1 = {'A → 'A = Nat → 'B}"}
            textClassName="p-2 font-mono text-xs leading-normal"
            className="rounded border outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {parsedDefinitions.errors.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[11px] text-destructive">
            {parsedDefinitions.errors.map((e, i) => (
              <li key={i}>{t("manualBuilder.definitionError", {line: e.line, message: e.message})}</li>
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
          wheel={{step: 0.1, excluded: ["input"]}}
          doubleClick={{mode: "zoomIn", excluded: ["input", "button"]}}
          panning={{velocityDisabled: true, excluded: ["input", "button"]}}
          limitToBounds={false}
        >
          {({zoomIn, zoomOut, centerView}) => (
            <TexRefExpansionProvider key={answerKey.id ?? "none"}>
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <ExportLatexButtons
                  buildTree={() => manualNodeToExportTree(manualTree, results, usesConstraints)}
                  filename="proof-tree-manual.tex"
                />
                <Button size="icon" variant="secondary" onClick={() => zoomIn()} title={t("proofTreeCanvas.zoomIn")}>
                  <ZoomIn className="h-4 w-4"/>
                </Button>
                <Button size="icon" variant="secondary" onClick={() => zoomOut()} title={t("proofTreeCanvas.zoomOut")}>
                  <ZoomOut className="h-4 w-4"/>
                </Button>
                <Button size="icon" variant="secondary" onClick={() => centerView()} title={t("proofTreeCanvas.centerView")}>
                  <Crosshair className="h-4 w-4"/>
                </Button>
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
