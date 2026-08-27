import {cn} from "@/shared/lib/utils.ts";
import {useTermHooks} from "@/shared/hooks/processTermHooks.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {Calculator, Check, ChevronDown} from "lucide-react";
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

export interface EvaluateButtonProps {
  onClick?: () => void;
  className?: string;
}

const evaluationStrategies = [
  {
    value: EvaluationStrategy.NORMAL,
    label: "Normal Order",
    description: "Leftmost outermost, including lambda bodies",
  },
  {
    value: EvaluationStrategy.CALL_BY_NAME,
    label: "Call by name",
    description: "Arguments are evaluated only when needed",
  },
  {
    value: EvaluationStrategy.CALL_BY_VALUE,
    label: "Call by value",
    description: "Arguments are evaluated before application",
  },
];

export function EvaluateButton({
                                  onClick,
                                  className
                                }: EvaluateButtonProps) {
  const { evaluateTerm } = useTermHooks()
  const dispatch = useAppDispatch();

  const proofTree = useAppSelector((state) => state.term.proof)
  const disabled = proofTree === undefined;
  const autoBuild = useAppSelector((state) => state.term.autoBuild);

  const strategy = useAppSelector((state) => state.term.evaluationStrategy)
  const setStrategy = (value: EvaluationStrategy) => dispatch(setEvaluationStrategy(value));

  const selectedStrategy = evaluationStrategies.find(
    (item) => item.value === strategy
  )

  const handleClick = () => {
    if (onClick) {
      onClick();
    }

    evaluateTerm(strategy);
  }

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
              onClick={(autoBuild || disabled) ? undefined : () => handleClick()}
              aria-disabled={autoBuild || disabled}
              className={cn("gap-2 shadow-none", (autoBuild || disabled) && "opacity-50 cursor-not-allowed")}
              size="default"
            >
              <Calculator className="h-4 w-4" />

              Evaluate

              <span className="text-xs opacity-70">
                ({selectedStrategy?.label})
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {autoBuild
              ? "Auto-build is on — this runs automatically as you type"
              : disabled
                ? "Parse & type-check a valid expression first"
                : "Reduce the expression to a normal form using the selected strategy"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="shadow-none h-fullby "
            aria-label="Choose evaluation strategy"
            disabled={disabled}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            Evaluation strategy
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {evaluationStrategies.map((item) => (
            <DropdownMenuItem
              key={item.value}
              onSelect={() => setStrategy(item.value)}
              className="flex justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
              {strategy === item.value && (
                <Check className="h-4 w-4" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}