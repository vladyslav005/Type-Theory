import {Handle, Position} from "@xyflow/react";
import type {BinOpNodeData} from "@/shared/presentation/flow/types.ts";
import {cn} from "@/shared/lib/utils";
import {LimitedHandle} from "./LimitedHandle.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select.tsx";

const OPERATORS = ["+", "-", "*", "/", "<", ">", "<=", ">=", "==", "!=", "and", "or"] as const;

export function BinOpFlowNode({data, selected}: { data: BinOpNodeData; selected?: boolean }) {
  return (
    <div className={cn(
      "min-w-56 rounded-xl border-2 bg-gradient-to-br from-card to-amber-500/5 text-card-foreground shadow-lg transition-all duration-150",
      selected
        ? "border-amber-500 shadow-amber-500/20"
        : "border-amber-500/30",
    )}>
      <Handle type="target" position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-background"/>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-amber-500/15">
        {data.editable ? (
          <Select
            value={data.term.operator}
            onValueChange={(v) => data.onChange?.({operator: v} as any)}
          >
            <SelectTrigger className="h-7 w-20 font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
              <SelectValue/>
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op} value={op} className="font-mono">{op}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400">{data.term.operator}</span>
        )}
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{data.term.operator === "and" || data.term.operator === "or" ? "Boolean operator" : "Arithmetic / Comparison"}</span>
      </div>

      {/* Two-column slot grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="relative flex flex-col items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-background/50 px-3 py-3">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Left</span>
          <LimitedHandle type="source" position={Position.Bottom} id="leftOperand" maxConnections={1}
            className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"/>
        </div>

        <div className="relative flex flex-col items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800 bg-background/50 px-3 py-3">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Right</span>
          <LimitedHandle type="source" position={Position.Bottom} id="rightOperand" maxConnections={1}
            className="!w-3 !h-3 !bg-amber-500 !border-2 !border-background"/>
        </div>
      </div>
    </div>
  );
}
