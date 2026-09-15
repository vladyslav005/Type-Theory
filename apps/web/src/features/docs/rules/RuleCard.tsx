import {MathJax} from "better-react-mathjax";
import {cn} from "@/shared/lib/utils.ts";
import {Card, CardContent} from "@/shared/components/ui/card.tsx";
import type {RuleDefinition} from "@/features/docs/rules/ruleDefinitions.ts";

const ruleNameStyle = {fontFamily: "'Times New Roman', Times, serif"};
// Scrolls instead of wrapping; overflow-y must be pinned too or MathJax spawns a stray scrollbar.
const mathRow = "overflow-x-auto overflow-y-hidden max-w-full [&_mjx-container]:!m-0 [&_mjx-container]:!inline-flex";

// Mirrors the real Proof Tree panel's visual language (proof-tree-using-css/ProofTree.css).
export function RuleCard({rule, className}: {rule: RuleDefinition; className?: string}) {
  const hasPremises = rule.premisesTex.length > 0;

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow duration-200 print:break-inside-avoid", className)}>
      <CardContent className="pt-6 pb-4 flex flex-col items-center gap-3">
        <div className="flex flex-col w-full">
          {hasPremises && (
            <div className={cn("flex flex-wrap items-end justify-center gap-x-5 gap-y-1 px-1 pb-1", mathRow)}>
              {rule.premisesTex.map((premise, i) => (
                <MathJax key={i} inline>{`\\(${premise}\\)`}</MathJax>
              ))}
            </div>
          )}

          {hasPremises ? (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 border-t border-foreground/50"/>
              <span className="text-sm text-muted-foreground italic whitespace-nowrap shrink-0" style={ruleNameStyle}>
                {rule.id}
              </span>
            </div>
          ) : null}

          <div className={cn("flex items-center gap-2 w-full", hasPremises ? "pt-1.5 justify-center" : "justify-center")}>
            <div className={mathRow}>
              <MathJax inline>{`\\(${rule.conclusionTex}\\)`}</MathJax>
            </div>
            {!hasPremises && (
              <span className="text-sm text-muted-foreground italic whitespace-nowrap shrink-0" style={ruleNameStyle}>
                {rule.id}
              </span>
            )}
          </div>
        </div>

        {rule.description && (
          <p className="text-xs text-muted-foreground leading-relaxed text-center">{rule.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
