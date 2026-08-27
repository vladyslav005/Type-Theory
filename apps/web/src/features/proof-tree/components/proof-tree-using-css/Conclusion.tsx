import {useState} from "react";
import {useTranslation} from "react-i18next";
import type {TexTree} from "@vladyslav005/tt-core";
import {MathJax} from "better-react-mathjax";
import "./ProofTree.css"
import {cn} from "@/shared/lib/utils.ts";
import {AlertCircle, ChevronDown, ChevronRight} from "lucide-react";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/components/ui/context-menu.tsx";
import {JudgementSegments} from "@/features/proof-tree/components/proof-tree-using-css/JudgementSegments.tsx";

interface ConclusionCenterProps {
  isItLeaf: string;
  isItRoot: string;
  node: TexTree;
  isDef?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const Conclusion = (props: ConclusionCenterProps) => {
  const {t} = useTranslation();
  const {isDef = false, isExpanded = false, onToggle} = props;
  const containsError = props.node.error !== undefined;
  const hasSegments = !!props.node.judgementSegments;
  const hasExpandableGamma = !hasSegments && !!props.node.judgementFull;
  const hasContextMenu = containsError || hasExpandableGamma;
  const [gammaExpanded, setGammaExpanded] = useState(false);

  const judgementTex = gammaExpanded && props.node.judgementFull
    ? props.node.judgementFull
    : props.node.judgement;

  const conclusionDiv = (
    <div
      className={cn(
        `conclusion-center ${props.isItLeaf} ${props.isItRoot} rounded-md my-1.5 px-2 flex items-center gap-2 transition-all duration-200`,
        containsError
          ? "bg-destructive/10 border border-destructive/30 dark:bg-destructive/15 dark:border-destructive/40"
          : "",
        isDef
          ? "cursor-pointer hover:bg-primary/10 border border-transparent hover:border-primary/20 select-none"
          : "",
      )}
      onClick={isDef ? onToggle : undefined}
    >
      {isDef && (
        <span className="text-primary shrink-0">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5"/>
            : <ChevronRight className="h-3.5 w-3.5"/>
          }
        </span>
      )}

      {hasSegments ? (
        <JudgementSegments
          className="flex-1"
          segments={props.node.judgementSegments!}
          registry={props.node.registry}
          nodeId={props.node.id ?? ""}
        />
      ) : (
        <MathJax className="flex-1" key={judgementTex}>
          {`\\[ ${judgementTex} \\]`}
        </MathJax>
      )}

      {containsError && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-destructive cursor-help shrink-0 rounded px-1 py-0.5 hover:bg-destructive/10 transition-colors">
                <AlertCircle className="h-3.5 w-3.5 shrink-0"/>
                <span className="text-xs font-semibold">{t("conclusion.error")}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-sm text-xs leading-relaxed border-destructive/30 bg-destructive/5 text-destructive dark:bg-destructive/10"
            >
              {props.node.error}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  const withContextMenu = (children: React.ReactNode) => {
    if (!hasContextMenu) return <>{children}</>;
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="max-w-xs">
          {containsError && (
            <>
              <ContextMenuLabel className="text-destructive font-normal text-xs leading-relaxed whitespace-normal py-2 px-2 max-w-xs">
                {props.node.error}
              </ContextMenuLabel>
              {hasExpandableGamma && <ContextMenuSeparator />}
            </>
          )}
          {hasExpandableGamma && (
            <ContextMenuItem onClick={() => setGammaExpanded(v => !v)}>
              {gammaExpanded ? t("proofTreeCanvas.collapseContext") : t("proofTreeCanvas.expandContext")}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const withDefTooltip = (children: React.ReactNode) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children as React.ReactElement}</TooltipTrigger>
        <TooltipContent side="top">
          {isExpanded
            ? t("conclusion.hideProof", {name: props.node.meta ?? t("conclusion.variable")})
            : t("conclusion.showProof", {name: props.node.meta ?? t("conclusion.variable")})}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const wrapped = withContextMenu(conclusionDiv);
  return isDef ? withDefTooltip(wrapped) : wrapped;
}
