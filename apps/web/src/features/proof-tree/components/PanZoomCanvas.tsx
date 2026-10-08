import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import {Crosshair, ZoomIn, ZoomOut} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {cn} from "@/shared/lib/utils.ts";

// The pan/zoom surface every proof-tree view uses: wheel zooms, drag pans, buttons in the corner.
export function PanZoomCanvas({children, className, compact = false}: {children: ReactNode; className?: string; compact?: boolean}) {
  const {t} = useTranslation();
  const buttonClass = compact ? "h-7 w-7" : undefined;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border bg-muted/30", className)}>
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={3}
        centerOnInit={true}
        wheel={{step: 0.1, excluded: ["input", "monaco-editor"]}}
        doubleClick={{mode: "zoomIn", excluded: ["input", "button", "rule-name", "manual-readonly", "monaco-editor"]}}
        panning={{velocityDisabled: true, excluded: ["input", "button", "rule-name", "manual-readonly", "monaco-editor"]}}
        limitToBounds={false}
      >
        {({zoomIn, zoomOut, centerView}) => (
          <>
            <div className={cn("absolute z-10 flex", compact ? "top-2 right-2 gap-1" : "top-4 right-4 gap-2")}>
              <Tip label={t("proofTreeCanvas.zoomIn")}>
                <Button size="icon" variant="secondary" className={buttonClass} onClick={() => zoomIn()}><ZoomIn className="h-4 w-4"/></Button>
              </Tip>
              <Tip label={t("proofTreeCanvas.zoomOut")}>
                <Button size="icon" variant="secondary" className={buttonClass} onClick={() => zoomOut()}><ZoomOut className="h-4 w-4"/></Button>
              </Tip>
              <Tip label={t("proofTreeCanvas.centerView")}>
                <Button size="icon" variant="secondary" className={buttonClass} onClick={() => centerView()}><Crosshair className="h-4 w-4"/></Button>
              </Tip>
            </div>
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full !flex !items-center !justify-center"
              wrapperStyle={{width: "100%", height: "100%", overflow: "hidden"}}
            >
              <div className="flex items-center justify-center p-6">{children}</div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
