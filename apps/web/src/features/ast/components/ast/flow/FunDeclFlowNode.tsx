import {Handle, Position} from "@xyflow/react";
import type {FunDeclNodeData} from "@/shared/presentation/flow/types.ts";
import {typeToString} from "@vladyslav005/tt-core";
import {Input} from "@/shared/components/ui/input";
import {cn} from "@/shared/lib/utils";
import {LimitedHandle} from "./LimitedHandle.tsx";

export function FunDeclFlowNode({data, selected}: { data: FunDeclNodeData; selected?: boolean }) {
  return (
    <div className={cn(
      "min-w-60 rounded-xl border-2 bg-gradient-to-br from-card to-green-500/5 text-card-foreground shadow-lg transition-all duration-150",
      selected
        ? "border-green-500 shadow-green-500/20"
        : "border-green-500/30",
    )}>
      <Handle type="target" position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-green-500 !border-2 !border-background"/>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-green-500/15">
        <span className="text-sm font-bold text-green-600 dark:text-green-400">ƒ</span>
        <span className="text-xs font-semibold text-green-600 dark:text-green-400">Function Declaration</span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
          <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-3 py-2">
            {data.editable ? (
              <Input
                value={data.term.name}
                onChange={(e) => data.onChange?.({name: e.target.value} as any)}
                className="h-7 text-sm font-bold font-mono text-green-700 dark:text-green-300"
              />
            ) : (
              <code className="text-sm font-bold font-mono text-green-700 dark:text-green-300">{data.term.name}</code>
            )}
          </div>
        </div>

        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Type Signature</label>
          {data.editable ? (
            <div className="h-9 rounded-lg border border-dashed border-green-300 dark:border-green-700 bg-background/30"/>
          ) : (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-background px-3 py-2">
              <code className="text-xs font-mono text-foreground/80">{data.term.type ? typeToString(data.term.type) : "(untyped)"}</code>
            </div>
          )}
          <LimitedHandle type="source" position={Position.Right} id="type" maxConnections={1}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"/>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between border-t border-green-500/15 pt-3">
        <span className="text-xs font-medium text-muted-foreground">value</span>
        <LimitedHandle type="source" position={Position.Bottom} id="value" maxConnections={1}
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"/>
      </div>
    </div>
  );
}
