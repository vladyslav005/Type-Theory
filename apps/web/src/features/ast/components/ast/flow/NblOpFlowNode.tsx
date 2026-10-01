import {Handle, Position} from "@xyflow/react";
import type {NblOpNodeData} from "@/shared/presentation/flow/types.ts";
import {cn} from "@/shared/lib/utils";
import {LimitedHandle} from "./LimitedHandle.tsx";

const TITLES = {Succ: "Successor", Pred: "Predecessor", IsZero: "Zero test"} as const;

export function NblOpFlowNode({data, selected}: { data: NblOpNodeData; selected?: boolean }) {
  return (
    <div className={cn(
      "min-w-40 rounded-xl border-2 bg-gradient-to-br from-card to-sky-500/5 text-card-foreground shadow-lg transition-all duration-150",
      selected
        ? "border-sky-500 shadow-sky-500/20"
        : "border-sky-500/30",
    )}>
      <Handle type="target" position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-sky-500 !border-2 !border-background"/>

      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-sky-500/15">
        <span className="text-sm font-bold font-mono text-sky-600 dark:text-sky-400">{data.term.kind.toLowerCase()}</span>
        <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">{TITLES[data.term.kind]}</span>
      </div>

      <div className="p-4">
        <div className="relative flex flex-col items-center gap-1 rounded-lg border border-sky-200 dark:border-sky-800 bg-background/50 px-3 py-3">
          <span className="text-xs font-medium text-sky-600 dark:text-sky-400">t</span>
          <LimitedHandle type="source" position={Position.Bottom} id="term" maxConnections={1}
            className="!w-3 !h-3 !bg-sky-500 !border-2 !border-background"/>
        </div>
      </div>
    </div>
  );
}
