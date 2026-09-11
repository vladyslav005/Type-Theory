import {useTranslation} from "react-i18next";
import {cn} from "@/shared/lib/utils.ts";
import {useTermHooks} from "@/shared/hooks/processTermHooks.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {Check, ChevronDown, Play} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu.tsx";
import {ButtonGroup} from "@/shared/components/ui/button-group.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {EvaluationStrategy} from "@vladyslav005/tt-core";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {setEvaluationStrategy} from "@/shared/ui-state/termSlice.ts";

export interface RunButtonProps {
  onClick?: () => void;
  className?: string;
}

const evaluationStrategies = [
  EvaluationStrategy.NORMAL,
  EvaluationStrategy.CALL_BY_NAME,
  EvaluationStrategy.CALL_BY_VALUE,
];

// Untyped lambda calculus has no meaningful "type-check" step to run separately (see
// STLCTypeChecker's untyped path) — Parse & Type Check and Evaluate collapse into one action.
export function RunButton({onClick, className}: RunButtonProps) {
  const {t} = useTranslation();
  const {parseAndTypeCheck, evaluateTerm} = useTermHooks();
  const dispatch = useAppDispatch();

  const autoBuild = useAppSelector((state) => state.term.autoBuild);
  const strategy = useAppSelector((state) => state.term.evaluationStrategy);
  const setStrategy = (value: EvaluationStrategy) => dispatch(setEvaluationStrategy(value));

  const handleClick = () => {
    if (onClick) {
      onClick();
    }

    const ast = parseAndTypeCheck();
    if (ast) {
      evaluateTerm(strategy, ast);
    }
  };

  return (
    <ButtonGroup
      className={cn(
        "shadow-lg transition-all duration-300 hover:shadow-xl",
        className
      )}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={autoBuild ? undefined : handleClick}
              aria-disabled={autoBuild}
              className={cn("gap-2 shadow-none", autoBuild && "opacity-50 cursor-not-allowed")}
              size="default"
            >
              <Play className="h-4 w-4" />

              {t("actions.run")}

              <span className="text-xs opacity-70">
                ({t(`evalStrategy.${strategy}.label`)})
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {autoBuild
              ? t("actions.autoBuildTooltip")
              : t("actions.runTooltip")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="shadow-none"
            aria-label={t("actions.chooseStrategy")}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            {t("evalStrategy.heading")}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {evaluationStrategies.map((value) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => setStrategy(value)}
              className="flex justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t(`evalStrategy.${value}.label`)}</span>
                <span className="text-xs text-muted-foreground">{t(`evalStrategy.${value}.description`)}</span>
              </div>
              {strategy === value && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
