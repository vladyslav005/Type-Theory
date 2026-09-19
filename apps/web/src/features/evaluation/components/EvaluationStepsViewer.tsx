import { createContext, useContext, useMemo, useState } from "react";
import type { Term, Type } from "@vladyslav005/tt-core";
import type { EvaluationResult, ReductionStep } from "@vladyslav005/tt-core";
import { accumulateBindings, type BoundEntry } from "@vladyslav005/tt-core";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { expandTypeAliases, normalizeType, typeEquals } from "@vladyslav005/tt-core";

// Lets TypeView (nested deep in TermView) resolve type aliases without threading a prop through every case.
const TypeAliasesContext = createContext<Record<string, Type>>({});

function TypeView({ type }: { type: Type }) {
  const { t } = useTranslation();
  const typeAliases = useContext(TypeAliasesContext);

  switch (type.kind) {
    case "TyIdentifier":
      return <span className="text-blue-600 dark:text-blue-400">{type.name}</span>;
    case "TyArrow":
      return (
        <>
          <TypeView type={type.from} />
          <span className="text-muted-foreground"> → </span>
          <TypeView type={type.to} />
        </>
      );
    case "SumType":
      return (
        <>
          <TypeView type={type.left} />
          <span className="text-muted-foreground"> + </span>
          <TypeView type={type.right} />
        </>
      );
    case "TupleType":
      return (
        <>
          <span className="text-muted-foreground">⟨</span>
          {type.elements.map((e, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground"> × </span>}
              <TypeView type={e} />
            </span>
          ))}
          <span className="text-muted-foreground">⟩</span>
        </>
      );
    case "VariantType":
      return (
        <>
          <span className="text-muted-foreground">⟨</span>
          {type.variants.map((v, i) => (
            <span key={v.label}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              {v.label}:<TypeView type={v.type} />
            </span>
          ))}
          <span className="text-muted-foreground">⟩</span>
        </>
      );
    case "RecordType":
      return (
        <>
          <span className="text-muted-foreground">{"{"}</span>
          {type.fields.map((f, i) => (
            <span key={f.label}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              {f.label}:<TypeView type={f.type} />
            </span>
          ))}
          <span className="text-muted-foreground">{"}"}</span>
        </>
      );
    case "TyForall":
      return (
        <>
          <span className="text-purple-600 dark:text-purple-400">∀{type.typeVariable}</span>
          <span className="text-muted-foreground">. </span>
          <TypeView type={type.type} />
        </>
      );
    case "TyMetaVar":
      return <span className="text-muted-foreground italic">{type.name}</span>;
    case "TyConstructorAbs":
      return (
        <>
          <span className="text-teal-600 dark:text-teal-400">λ{type.typeParam}</span>
          <span className="text-muted-foreground">. </span>
          <TypeView type={type.body} />
        </>
      );
    case "TyConstructorApp": {
      const reduced = normalizeType(expandTypeAliases(type, new Map(Object.entries(typeAliases))));
      const isReducible = !typeEquals(reduced, type);

      return (
        <>
          <TypeView type={type.func} />
          <span className="text-muted-foreground"> </span>
          <TypeView type={type.arg} />
          {isReducible && (
            <span
              className="ml-1 rounded px-1 py-0.5 text-xs italic text-teal-600 dark:text-teal-400 bg-teal-500/10"
              title={t("evalSteps.typeLevelReduction")}
            >
              ⇒ <TypeView type={reduced} />
            </span>
          )}
        </>
      );
    }
    case "ListType":
      return (
        <>
          <span className="text-blue-600 dark:text-blue-400">List </span>
          <TypeView type={type.elementType} />
        </>
      );
    case "RecursiveType":
      return (
        <>
          <span className="text-green-600 dark:text-green-400">μ{type.typeVariable}</span>
          <span className="text-muted-foreground">. </span>
          <TypeView type={type.type} />
        </>
      );
  }
}

function TermView({
  term,
  selectedId,
  resultId,
  errorId,
}: {
  term: Term;
  selectedId?: string;
  resultId?: string;
  errorId?: string;
}) {
  const isError = errorId !== undefined && term.id === errorId;
  const isResult = !isError && resultId !== undefined && term.id === resultId;
  const isSelected = !isError && !isResult && selectedId !== undefined && term.id === selectedId;

  const inner = (() => {
    switch (term.kind) {
      case "Var":
        return <span>{term.name}</span>;
      case "Lit":
        return <span className="text-amber-600 dark:text-amber-400">{term.value}</span>;
      case "Abs":
        return (
          <>
            <span className="text-purple-600 dark:text-purple-400">λ</span>
            <span> {term.param}</span>
            {term.paramType && (
              <>
                <span className="text-muted-foreground"> : </span>
                <TypeView type={term.paramType} />
              </>
            )}
            <span className="text-muted-foreground"> . </span>
            <TermView term={term.body} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "App":
        return (
          <>
            <span className="text-muted-foreground">(</span>
            <TermView term={term.func} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground"> </span>
            <TermView term={term.arg} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground">)</span>
          </>
        );
      case "Let":
        return (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">let </span>
            <span>{term.name}</span>
            <span className="text-muted-foreground"> = </span>
            <TermView term={term.value} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-emerald-600 dark:text-emerald-400"> in </span>
            <TermView term={term.body} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Inl":
        return (
          <>
            <span className="text-rose-600 dark:text-rose-400">inl </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground"> as </span>
            <TypeView type={term.type} />
          </>
        );
      case "Inr":
        return (
          <>
            <span className="text-pink-600 dark:text-pink-400">inr </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground"> as </span>
            <TypeView type={term.type} />
          </>
        );
      case "IfCondition":
        return (
          <>
            <span className="text-cyan-600 dark:text-cyan-400">if </span>
            <TermView term={term.condition} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-cyan-600 dark:text-cyan-400"> then </span>
            <TermView term={term.then} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            {(term.elif ?? []).map((b, i) => (
              <span key={i}>
                <span className="text-cyan-600 dark:text-cyan-400"> elseif </span>
                <TermView term={b.condition} selectedId={selectedId} resultId={resultId} errorId={errorId} />
                <span className="text-cyan-600 dark:text-cyan-400"> then </span>
                <TermView term={b.then} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </span>
            ))}
            {term.else && (
              <>
                <span className="text-cyan-600 dark:text-cyan-400"> else </span>
                <TermView term={term.else} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </>
            )}
          </>
        );
      case "Case":
        return (
          <>
            <span className="text-indigo-600 dark:text-indigo-400">case </span>
            <TermView term={term.variable} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-indigo-600 dark:text-indigo-400"> of inl {term.inl.variable} ⇒ </span>
            <TermView term={term.inl.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-indigo-600 dark:text-indigo-400"> | inr {term.inr.variable} ⇒ </span>
            <TermView term={term.inr.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "VariantCase":
        return (
          <>
            <span className="text-violet-600 dark:text-violet-400">case </span>
            <TermView term={term.variable} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-violet-600 dark:text-violet-400"> of </span>
            {term.cases.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="text-violet-600 dark:text-violet-400"> | </span>}
                [{c.label}={c.variable}] ⇒{" "}
                <TermView term={c.body} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </span>
            ))}
          </>
        );
      case "Variant":
        return (
          <>
            <span className="text-fuchsia-600 dark:text-fuchsia-400">[</span>
            {term.variants.map((v, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground">, </span>}
                {v.label}=<TermView term={v.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </span>
            ))}
            <span className="text-fuchsia-600 dark:text-fuchsia-400">] </span>
            <span className="text-muted-foreground">as </span>
            <TypeView type={term.type} />
          </>
        );
      case "Ascribe":
        return (
          <>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-teal-600 dark:text-teal-400"> as </span>
            <TypeView type={term.type} />
          </>
        );
      case "TupleProjection":
        return (
          <>
            <TermView term={term.tuple} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-lime-600 dark:text-lime-400">.{term.index}</span>
          </>
        );
      case "RecordProjection":
        return (
          <>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-orange-600 dark:text-orange-400">.{term.label}</span>
          </>
        );
      case "Record":
        return (
          <>
            <span className="text-orange-600 dark:text-orange-400">⟨</span>
            {term.fields.map((f, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground">, </span>}
                {f.label}=<TermView term={f.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </span>
            ))}
            <span className="text-orange-600 dark:text-orange-400">⟩</span>
          </>
        );
      case "Sequencing":
        return (
          <>
            <TermView term={term.first} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-sky-600 dark:text-sky-400">; </span>
            <TermView term={term.second} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Tuple":
        return (
          <>
            <span className="text-lime-600 dark:text-lime-400">⟨</span>
            {term.elements.map((e, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground">, </span>}
                <TermView term={e} selectedId={selectedId} resultId={resultId} errorId={errorId} />
              </span>
            ))}
            <span className="text-lime-600 dark:text-lime-400">⟩</span>
          </>
        );
      case "DummyAbstraction":
        return (
          <>
            <span className="text-violet-600 dark:text-violet-400">λ_</span>
            <span className="text-muted-foreground"> : </span>
            <TypeView type={term.paramType} />
            <span className="text-muted-foreground"> . </span>
            <TermView term={term.body} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "BinOp":
        return (
          <>
            <span className="text-muted-foreground">(</span>
            <TermView term={term.left} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-amber-600 dark:text-amber-400"> {term.operator} </span>
            <TermView term={term.right} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground">)</span>
          </>
        );
      case "Fix":
        return (
          <>
            <span className="text-red-600 dark:text-red-400">fix </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "TypeAbs":
        return (
          <>
            <span className="text-indigo-600 dark:text-indigo-400">Λ</span>
            <span> {term.typeParam}</span>
            <span className="text-muted-foreground"> . </span>
            <TermView term={term.body} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "TypeApp":
        return (
          <>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-fuchsia-600 dark:text-fuchsia-400"> [</span>
            <TypeView type={term.typeArg} />
            <span className="text-fuchsia-600 dark:text-fuchsia-400">]</span>
          </>
        );
      case "Nil":
        return (
          <>
            <span className="text-blue-600 dark:text-blue-400">nil[</span>
            <TypeView type={term.type} />
            <span className="text-blue-600 dark:text-blue-400">]</span>
          </>
        );
      case "Cons":
        return (
          <>
            <span className="text-blue-600 dark:text-blue-400">cons[</span>
            <TypeView type={term.type} />
            <span className="text-blue-600 dark:text-blue-400">] </span>
            <TermView term={term.head} selectedId={selectedId} resultId={resultId} errorId={errorId} />
            <span className="text-muted-foreground"> </span>
            <TermView term={term.tail} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "IsNil":
        return (
          <>
            <span className="text-blue-600 dark:text-blue-400">isnil[</span>
            <TypeView type={term.type} />
            <span className="text-blue-600 dark:text-blue-400">] </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Head":
        return (
          <>
            <span className="text-blue-600 dark:text-blue-400">head[</span>
            <TypeView type={term.type} />
            <span className="text-blue-600 dark:text-blue-400">] </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Tail":
        return (
          <>
            <span className="text-blue-600 dark:text-blue-400">tail[</span>
            <TypeView type={term.type} />
            <span className="text-blue-600 dark:text-blue-400">] </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Fold":
        return (
          <>
            <span className="text-green-600 dark:text-green-400">fold[</span>
            <TypeView type={term.type} />
            <span className="text-green-600 dark:text-green-400">] </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
      case "Unfold":
        return (
          <>
            <span className="text-green-600 dark:text-green-400">unfold[</span>
            <TypeView type={term.type} />
            <span className="text-green-600 dark:text-green-400">] </span>
            <TermView term={term.term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
          </>
        );
    }
  })();

  if (isError) {
    return (
      <span className="bg-destructive/15 text-destructive rounded px-0.5 ring-1 ring-destructive/40 font-semibold">
        {inner}
      </span>
    );
  }

  if (isResult) {
    return (
      <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded px-0.5 ring-1 ring-emerald-500/30 font-semibold">
        {inner}
      </span>
    );
  }

  if (isSelected) {
    return (
      <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded px-0.5 ring-1 ring-orange-500/40 font-semibold">
        {inner}
      </span>
    );
  }

  return <>{inner}</>;
}

function TermBox({
  term,
  selectedId,
  resultId,
  errorId,
  label,
  hasError,
}: {
  term: Term;
  selectedId?: string;
  resultId?: string;
  errorId?: string;
  label: string;
  hasError?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</div>
      <div
        className={cn(
          "p-4 rounded-xl border font-mono text-sm leading-relaxed overflow-x-auto",
          hasError ? "bg-destructive/5 border-destructive/30" : "bg-muted/30",
        )}
      >
        <TermView term={term} selectedId={selectedId} resultId={resultId} errorId={errorId} />
      </div>
    </div>
  );
}

function GammaPanel({
  bindings,
  globals,
}: {
  bindings: BoundEntry[];
  globals: Record<string, Term>;
}) {
  const { t } = useTranslation();
  const globalEntries = Object.entries(globals);
  const hasAny = bindings.length > 0 || globalEntries.length > 0;

  return (
    <div className="w-72 shrink-0 rounded-xl border bg-muted/30 p-4">
      <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        {t("evalSteps.gammaHeader")}
      </div>

      {!hasAny && (
        <p className="text-xs text-muted-foreground">{t("evalSteps.noBindings")}</p>
      )}

      {bindings.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {bindings.map((entry) => (
            <div
              key={entry.name}
              className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-2.5 py-1.5 font-mono text-xs overflow-x-auto"
            >
              <span className="text-orange-600 dark:text-orange-400 font-semibold">{entry.name}</span>
              <span className="text-muted-foreground"> = </span>
              <TermView term={entry.value} />
            </div>
          ))}
        </div>
      )}

      {globalEntries.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            {t("evalSteps.globals")}
          </div>
          <div className="flex flex-col gap-2">
            {globalEntries.map(([name, def]) => (
              <div
                key={name}
                className="rounded-lg border bg-background/50 px-2.5 py-1.5 font-mono text-xs overflow-x-auto"
              >
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{name}</span>
                <span className="text-muted-foreground"> = </span>
                <TermView term={def} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: "single" | "all";
  onChange: (m: "single" | "all") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
      <button
        className={cn(
          "px-2.5 py-1 transition-colors",
          mode === "single" ? "bg-muted font-medium" : "hover:bg-muted/50",
        )}
        onClick={() => onChange("single")}
      >
        {t("evalSteps.viewStep")}
      </button>
      <button
        className={cn(
          "px-2.5 py-1 border-l transition-colors",
          mode === "all" ? "bg-muted font-medium" : "hover:bg-muted/50",
        )}
        onClick={() => onChange("all")}
      >
        {t("evalSteps.viewAll")}
      </button>
    </div>
  );
}

interface StepRowProps {
  step: ReductionStep;
  index: number;
  isLast: boolean;
  isError: boolean;
  stuckTermId?: string;
  onClick?: () => void;
}

function StepRow({ step, index, isError: isErrorStep, stuckTermId, onClick }: StepRowProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 transition-colors",
        isErrorStep
          ? "bg-destructive/5 border-destructive/20"
          : "bg-muted/20 hover:bg-muted/40 cursor-pointer",
      )}
      onClick={!isErrorStep ? onClick : undefined}
      title={!isErrorStep ? t("evalSteps.clickToInspect") : undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-semibold px-1.5 py-0.5 rounded-md",
            isErrorStep
              ? "bg-destructive/10 text-destructive"
              : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
          )}
        >
          {index + 1}
        </span>
        <span className="text-xs text-muted-foreground">
          {isErrorStep ? t("evalSteps.stuck") : t("evalSteps.betaReduction")}
        </span>
      </div>

      <div className="font-mono text-sm overflow-x-auto">
        <TermView term={step.before} selectedId={step.selectedId} />
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        <ArrowDown className={cn("h-3.5 w-3.5 shrink-0", isErrorStep && "text-destructive")} />
      </div>

      <div className="font-mono text-sm overflow-x-auto">
        <TermView
          term={step.after}
          resultId={!isErrorStep ? step.resultId : undefined}
          errorId={isErrorStep ? stuckTermId : undefined}
        />
      </div>
    </div>
  );
}

interface EvaluationStepsViewerProps {
  evaluation: EvaluationResult;
  typeAliases?: Record<string, Type>;
  viewMode: "single" | "all";
  onViewModeChange: (m: "single" | "all") => void;
  showGamma: boolean;
}

// Wraps EvaluationStepsViewerInner so its early returns don't each need the provider individually.
const DOT_WINDOW = 4;

// Long traces (up to 500 steps) can't render one dot each without overflowing the panel — keep
// the first/last step plus a window around the current one, with null marking an elided gap.
function visibleDotIndexes(total: number, current: number): (number | null)[] {
  if (total <= 2 * DOT_WINDOW + 5) return Array.from({length: total}, (_, i) => i);
  const from = Math.max(1, current - DOT_WINDOW);
  const to = Math.min(total - 2, current + DOT_WINDOW);
  const result: (number | null)[] = [0];
  if (from > 1) result.push(null);
  for (let i = from; i <= to; i += 1) result.push(i);
  if (to < total - 2) result.push(null);
  result.push(total - 1);
  return result;
}

export function EvaluationStepsViewer({ evaluation, typeAliases = {}, viewMode, onViewModeChange, showGamma }: EvaluationStepsViewerProps) {
  return (
    <TypeAliasesContext.Provider value={typeAliases}>
      <EvaluationStepsViewerInner
        evaluation={evaluation}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        showGamma={showGamma}
      />
    </TypeAliasesContext.Provider>
  );
}

interface EvaluationStepsViewerInnerProps {
  evaluation: EvaluationResult;
  viewMode: "single" | "all";
  onViewModeChange: (m: "single" | "all") => void;
  showGamma: boolean;
}

function EvaluationStepsViewerInner({ evaluation, viewMode, onViewModeChange, showGamma }: EvaluationStepsViewerInnerProps) {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const { steps, result, reachedStepLimit, errors, globals } = evaluation;

  const hasErrors = errors && errors.length > 0;
  const stuckTermId = errors?.[0]?.stuckTermId;
  // Whatever `result` holds when reduction stopped without erroring — only actually a normal
  // form (nothing left to reduce) if it got there on its own, not because we cut it off.
  const isFullyReduced = !reachedStepLimit;

  const bindingsAtCurrentStep = useMemo(
    () => accumulateBindings(steps, stepIndex),
    [steps, stepIndex],
  );

  if (steps.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-xl bg-muted/30 border text-center">
          <p className="text-sm text-muted-foreground">
            {hasErrors
              ? t("evalSteps.alreadyStuck")
              : t("evalSteps.alreadyNormal")}
          </p>
        </div>
        <TermBox term={result} label={hasErrors ? t("evalSteps.stuckTerm") : t("evalSteps.normalForm")} errorId={stuckTermId} hasError={hasErrors} />
        {hasErrors && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errors[0].message}</span>
          </div>
        )}
      </div>
    );
  }

  const currentStep = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const isErrorStep = isLastStep && hasErrors;

  if (viewMode === "all") {
    return (
      <div className="flex flex-col gap-4 h-full overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 backdrop-blur-sm py-1 z-10">
          <span className="text-sm font-medium">{t("evalSteps.steps", {count: steps.length})}</span>
        </div>

        <div className="flex flex-col gap-2">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const isStepError = isLast && !!hasErrors;
            return (
              <StepRow
                key={i}
                step={step}
                index={i}
                isLast={isLast}
                isError={isStepError}
                stuckTermId={stuckTermId}
                onClick={() => { setStepIndex(i); onViewModeChange("single"); }}
              />
            );
          })}
        </div>

        {!hasErrors && (
          <div className={cn(
            "p-4 rounded-xl border",
            isFullyReduced ? "bg-orange-500/5 border-orange-500/20" : "bg-yellow-500/5 border-yellow-500/20",
          )}>
            <div className="flex items-center gap-2 mb-2">
              {isFullyReduced
                ? <CheckCircle2 className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                : <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-500" />}
              <span className={cn(
                "text-xs font-medium uppercase tracking-wide",
                isFullyReduced ? "text-orange-600 dark:text-orange-500" : "text-yellow-700 dark:text-yellow-500",
              )}>
                {t(isFullyReduced ? "evalSteps.finalResult" : "evalSteps.stoppedResult")}
              </span>
            </div>
            <div className="font-mono text-sm overflow-x-auto">
              <TermView term={result} />
            </div>
          </div>
        )}

        {hasErrors && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errors![0].message}</span>
          </div>
        )}

        {reachedStepLimit && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-700 dark:text-yellow-500 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("evalSteps.stepLimit")}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 sticky top-0 backdrop-blur-sm py-1 z-10">
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setStepIndex(0)}
            disabled={isFirstStep}
            title={t("evalSteps.first")}
            aria-label={t("evalSteps.first")}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("evalSteps.prev")}
          </Button>
        </div>

        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <span className="text-sm font-medium">
            {t("evalSteps.stepOf", {current: stepIndex + 1, total: steps.length})}
          </span>
          <div className="flex items-center gap-1">
            {visibleDotIndexes(steps.length, stepIndex).map((i, slot) => {
              if (i === null) {
                return <span key={`gap-${slot}`} className="text-xs leading-none text-muted-foreground/60">…</span>;
              }
              const isLast = i === steps.length - 1;
              const isActive = i === stepIndex;
              return (
                <button
                  key={i}
                  onClick={() => setStepIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    isActive
                      ? isLast && hasErrors
                        ? "w-4 bg-destructive"
                        : "w-4 bg-orange-500"
                      : isLast && hasErrors
                        ? "w-1.5 bg-destructive/40 hover:bg-destructive/70"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                  )}
                  aria-label={t("evalSteps.goToStep", {n: i + 1})}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={isLastStep}
          >
            {t("evalSteps.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setStepIndex(steps.length - 1)}
            disabled={isLastStep}
            title={t("evalSteps.last")}
            aria-label={t("evalSteps.last")}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Step display */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <TermBox
            term={currentStep.before}
            selectedId={currentStep.selectedId}
            label={t("evalSteps.before")}
          />

          <div className="flex items-center gap-2 text-muted-foreground px-2">
            <ArrowDown className={cn("h-4 w-4 shrink-0", isErrorStep && "text-destructive")} />
            <span className="text-xs">{isErrorStep ? t("evalSteps.stuck") : t("evalSteps.betaReduction")}</span>
          </div>

          <TermBox
            term={currentStep.after}
            label={t("evalSteps.after")}
            resultId={!isErrorStep ? currentStep.resultId : undefined}
            errorId={isErrorStep ? stuckTermId : undefined}
            hasError={isErrorStep}
          />

          {isErrorStep && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errors![0].message}</span>
            </div>
          )}

          {isLastStep && !hasErrors && (
            <div className={cn(
              "p-4 rounded-xl border",
              isFullyReduced ? "bg-orange-500/5 border-orange-500/20" : "bg-yellow-500/5 border-yellow-500/20",
            )}>
              <div className="flex items-center gap-2 mb-2">
                {isFullyReduced
                  ? <CheckCircle2 className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                  : <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-500" />}
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  isFullyReduced ? "text-orange-600 dark:text-orange-500" : "text-yellow-700 dark:text-yellow-500",
                )}>
                  {t(isFullyReduced ? "evalSteps.finalResult" : "evalSteps.stoppedResult")}
                </span>
              </div>
              <div className="font-mono text-sm overflow-x-auto">
                <TermView term={result} />
              </div>
            </div>
          )}
        </div>

        {showGamma && <GammaPanel bindings={bindingsAtCurrentStep} globals={globals} />}
      </div>

      {reachedStepLimit && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-yellow-700 dark:text-yellow-500 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{t("evalSteps.stepLimit")}</span>
        </div>
      )}
    </div>
  );
}
