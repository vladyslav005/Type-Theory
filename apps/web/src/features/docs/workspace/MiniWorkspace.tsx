import {MathJax} from "better-react-mathjax";
import {Button} from "@/shared/components/ui/button.tsx";
import {useMiniWorkspace} from "@/features/docs/workspace/useMiniWorkspace.ts";

interface MiniWorkspaceProps {
  initialTerm: string;
  label?: string;
  hint?: string;
}

export function MiniWorkspace({initialTerm, label = "Try it yourself", hint}: MiniWorkspaceProps) {
  const {termText, setTermText, check, reset, result, error, checked} = useMiniWorkspace(initialTerm);
  const dirty = termText !== initialTerm;

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>

      <textarea
        value={termText}
        onChange={(e) => setTermText(e.target.value)}
        spellCheck={false}
        rows={3}
        className="w-full font-mono text-sm rounded-md border bg-background p-3 resize-y outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={check}>Check type</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>}
      </div>

      {checked && (
        result ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Type:</span>
            <MathJax inline>{`\\(${result.typeTex}\\)`}</MathJax>
          </div>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        )
      )}
    </div>
  );
}
