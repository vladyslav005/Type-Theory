import {useTranslation} from "react-i18next";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {Crosshair, ZoomIn, ZoomOut} from "lucide-react";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {useMemo} from "react";
import {exitBuildMode, setManualDefinitions, setManualResults} from "@/shared/ui-state/termSlice.ts";
import {countManualNodes} from "@/shared/ui-state/manualProof.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {checkManualTree} from "@/features/proof-tree/manual/manualCheck.ts";
import {parseDefinitions} from "@/shared/lib/manualParse.ts";
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

  const definitionsHistory = useUndoableText(manualDefinitions ?? "", (next) => dispatch(setManualDefinitions(next)));
  const parsedDefinitions = useMemo(() => parseDefinitions(manualDefinitions ?? ""), [manualDefinitions]);

  if (!manualTree || !answerKey) return null;

  const results = manualResults ?? {};
  const checked = Object.keys(results).length > 0;
  const nodeResults = Object.values(results);
  const invalid = nodeResults.filter((r) => Object.values(r).some((v) => v === "invalid")).length;

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
          <Button size="sm" onClick={check}>{t("proofBuilder.checkProof")}</Button>
          {checked && (
            <Button size="sm" variant="outline" onClick={() => dispatch(setManualResults({}))}>{t("manualBuilder.clearMarks")}</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => dispatch(exitBuildMode())}>{t("proofBuilder.exit")}</Button>
        </div>
      </div>

      <details className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
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
            <>
              <div className="absolute top-4 right-4 z-10 flex gap-2">
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
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
