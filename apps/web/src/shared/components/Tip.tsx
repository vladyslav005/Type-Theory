import type {ReactNode} from "react";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";

interface TipProps {
  label: string | undefined;
  children: ReactNode;
  block?: boolean;
  side?: "top" | "bottom" | "left" | "right";
}

// shadcn tooltip around any control; the span keeps it working on disabled buttons, which get no pointer events.
export function Tip({label, children, block = false, side = "bottom"}: TipProps) {
  if (!label) return <>{children}</>;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={block ? "flex w-full" : "inline-flex"}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
