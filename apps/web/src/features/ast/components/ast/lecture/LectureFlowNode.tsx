import {Handle, Position} from "@xyflow/react";
import {ChevronDown, ChevronRight} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {lectureLabel, lectureSlots} from "./lectureTree.ts";

const HIDDEN_HANDLE = "!w-1 !h-1 !min-w-0 !min-h-0 !border-0 !bg-transparent";

export function LectureFlowNode({data}: {data: any}) {
  const term = data?.term;
  const globalRef = !!data?.globalRef;
  return (
    <div className={cn(
      "relative px-1.5 font-serif italic text-xl leading-8 text-foreground whitespace-nowrap",
      globalRef && "flex items-center gap-0.5 rounded-md cursor-pointer select-none border border-transparent hover:bg-primary/10 hover:border-primary/20",
    )}>
      <Handle type="target" position={Position.Top} isConnectable={false} className={HIDDEN_HANDLE}/>
      {globalRef && (
        <span className="text-primary not-italic">
          {data.expanded ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}
        </span>
      )}
      {lectureLabel(term)}
      {lectureSlots(term).map((slot) => (
        <Handle key={slot} type="source" position={Position.Bottom} id={slot} isConnectable={false} className={HIDDEN_HANDLE}/>
      ))}
    </div>
  );
}
