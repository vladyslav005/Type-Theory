import {useTranslation} from "react-i18next";
import {cn} from "@/shared/lib/utils.ts";
import {useTermHooks} from "@/shared/hooks/processTermHooks.ts";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {Network} from "lucide-react";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";

export interface TypeCheckButtonProps {
  onClick?: () => void;
  className?: string;
}

export function TypeCheckButton({
                                  onClick,
                                  className
                                }: TypeCheckButtonProps) {
  const { t } = useTranslation();
  const { parseAndTypeCheck } = useTermHooks()
  const autoBuild = useAppSelector((state) => state.term.autoBuild);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }

    parseAndTypeCheck();
  }

  // aria-disabled (not the native `disabled` attribute) so the button stays hoverable —
  // a truly disabled element blocks pointer events and the tooltip below would never open.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={autoBuild ? undefined : handleClick}
            aria-disabled={autoBuild}
            className={cn(
              "shadow-lg hover:shadow-xl transition-all duration-300 gap-2",
              autoBuild && "opacity-50 cursor-not-allowed",
              className
            )}
            size="default"
          >
            <Network className="h-4 w-4" />
            {t("actions.typeCheck")}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {autoBuild
            ? t("actions.autoBuildTooltip")
            : t("actions.typeCheckTooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}