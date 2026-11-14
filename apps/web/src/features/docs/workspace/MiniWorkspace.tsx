import {useTranslation} from "react-i18next";
import {trackWidgetUse} from "@/shared/activity/taskTracking.ts";
import {MathJax} from "better-react-mathjax";
import {Button} from "@/shared/components/ui/button.tsx";
import {useMiniWorkspace} from "@/features/docs/workspace/useMiniWorkspace.ts";
import {LabEditor} from "@/features/docs/labs/components/LabEditor.tsx";
import type {TypeTheoryConfig} from "@vladyslav005/tt-core";

interface MiniWorkspaceProps {
  initialTerm: string;
  label?: string;
  hint?: string;
  theories?: Partial<TypeTheoryConfig>;
}

export function MiniWorkspace({initialTerm, label, hint, theories}: MiniWorkspaceProps) {
  const {t} = useTranslation();
  const {termText, setTermText, check, reset, result, error, checked} = useMiniWorkspace(initialTerm, theories);
  const dirty = termText !== initialTerm;

  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3 print:hidden">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label ?? t("lectureWidgets.tryYourself")}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>

      <LabEditor
        value={termText}
        onChange={setTermText}
        onSubmit={() => { trackWidgetUse("miniWorkspace"); check(); }}
        className="w-full"
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => { trackWidgetUse("miniWorkspace"); check(); }}>{t("lectureWidgets.checkType")}</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={reset}>{t("lectureWidgets.reset")}</Button>}
      </div>

      {checked && (
        result ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("lectureWidgets.type")}</span>
            <MathJax inline>{`\\(${result.typeTex}\\)`}</MathJax>
          </div>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        )
      )}
    </div>
  );
}
