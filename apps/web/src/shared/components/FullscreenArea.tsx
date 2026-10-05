import {useRef, type ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Maximize2, Minimize2} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Tip} from "@/shared/components/Tip.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {useFullscreen} from "@/shared/hooks/useFullscreen.ts";

interface FullscreenAreaProps {
  // Gets `full` to let the canvas grow, and the toggle button to place among the task's own controls.
  children: (state: {full: boolean; button: ReactNode}) => ReactNode;
  // Shown above the content only in fullscreen, where the task's text is out of sight.
  title?: ReactNode;
  className?: string;
}

export function FullscreenArea({children, title, className}: FullscreenAreaProps) {
  const {t} = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const {isFullscreen, isPseudoFullscreen, toggle} = useFullscreen(ref);
  const label = isFullscreen ? t("fullscreen.exit") : t("fullscreen.enter");
  const button = (
    <Tip label={label}>
      <Button size="icon" variant="ghost" className="size-8" onClick={toggle} aria-label={label}>
        {isFullscreen ? <Minimize2 className="h-4 w-4"/> : <Maximize2 className="h-4 w-4"/>}
      </Button>
    </Tip>
  );
  return (
    <div
      ref={ref}
      className={cn(
        "space-y-2",
        className,
        isFullscreen && "flex h-full w-full flex-col gap-3 space-y-0 overflow-auto rounded-none border-0 bg-background p-4",
        isPseudoFullscreen && "fixed inset-0 z-50 h-[100dvh] w-[100dvw]",
      )}
    >
      {isFullscreen && title !== undefined && <div className="shrink-0 font-mono text-sm">{title}</div>}
      {children({full: isFullscreen, button})}
    </div>
  );
}
