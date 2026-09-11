import {useCallback, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import type {InferenceStep} from "@vladyslav005/tt-core";
import {typeToString} from "@vladyslav005/tt-core";
import {cn} from "@/shared/lib/utils.ts";

interface InferenceConstraintListProps {
  steps: InferenceStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const DEFAULT_WIDTH = 288;
const MIN_WIDTH = 220;
const MAX_WIDTH = 560;

// A "table of contents" for an inference trace — lets you see the whole constraint set at a
// glance and jump straight to any step, rather than only ever moving one step at a time.
export function InferenceConstraintList({steps, activeIndex, onSelect}: InferenceConstraintListProps) {
  const {t} = useTranslation();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragState = useRef<{startX: number; startWidth: number} | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = {startX: e.clientX, startWidth: width};

    const onMove = (moveEvent: PointerEvent) => {
      if (!dragState.current) return;
      // Panel sits on the right, so dragging left (negative clientX delta) grows it.
      const delta = dragState.current.startX - moveEvent.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragState.current.startWidth + delta)));
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [width]);

  return (
    <div className="shrink-0 flex" style={{width}}>
      <div
        onPointerDown={handlePointerDown}
        role="separator"
        aria-orientation="vertical"
        title={t("proofTree.resizePanel")}
        className="w-1.5 shrink-0 cursor-col-resize touch-none hover:bg-primary/25 active:bg-primary/35 transition-colors"
      />
      <div className="flex-1 min-w-0 border-l bg-muted/30 p-3 overflow-y-auto">
        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide px-1">
          {t("proofTree.constraintListHeader")}
        </div>
        <div className="flex flex-col gap-1.5">
          {steps.map((step, i) => {
            const isActive = i === activeIndex;
            const isError = step.error !== undefined;

            return (
              <button
                key={i}
                onClick={() => onSelect(i)}
                title={isActive ? t("proofTree.clickToUndoStep") : t("proofTree.clickToApplyStep")}
                className={cn(
                  "text-left rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-colors overflow-hidden",
                  isError
                    ? "border-destructive/30 bg-destructive/5"
                    : isActive
                      ? "border-orange-500/40 bg-orange-500/10"
                      : "border-transparent hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "inline-block text-[10px] font-semibold px-1 rounded mb-1",
                    isError ? "bg-destructive/10 text-destructive" : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                  )}
                >
                  {i + 1}
                </span>
                <div className="truncate">
                  {typeToString(step.constraint.left)} ~ {typeToString(step.constraint.right)}
                </div>
                {isError ? (
                  <div className="text-destructive truncate mt-0.5">{step.error}</div>
                ) : step.newBindings.length > 0 ? (
                  <div className="text-blue-600 dark:text-blue-400 truncate mt-0.5">
                    {step.newBindings.map((b) => `${b.name} := ${typeToString(b.type)}`).join(", ")}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
