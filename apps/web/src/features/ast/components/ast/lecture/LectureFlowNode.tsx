import {Handle, Position} from "@xyflow/react";
import {lectureLabel, lectureSlots} from "./lectureTree.ts";

const HIDDEN_HANDLE = "!w-1 !h-1 !min-w-0 !min-h-0 !border-0 !bg-transparent";

export function LectureFlowNode({data}: {data: any}) {
  const term = data?.term;
  return (
    <div className="relative px-1.5 font-serif italic text-xl leading-8 text-foreground whitespace-nowrap">
      <Handle type="target" position={Position.Top} isConnectable={false} className={HIDDEN_HANDLE}/>
      {lectureLabel(term)}
      {lectureSlots(term).map((slot) => (
        <Handle key={slot} type="source" position={Position.Bottom} id={slot} isConnectable={false} className={HIDDEN_HANDLE}/>
      ))}
    </div>
  );
}
