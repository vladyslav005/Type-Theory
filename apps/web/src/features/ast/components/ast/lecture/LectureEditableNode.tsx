import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Handle, Position} from "@xyflow/react";
import {cn} from "@/shared/lib/utils.ts";
import {lectureLabel, lectureSlots, TYPE_SLOTS} from "./lectureTree.ts";

const SLOT_LABELS: Record<string, string> = {
  term: "term", body: "body", value: "value", left: "fn", right: "arg", condition: "cond", then: "then", else: "else",
  variable: "scrutinee", "inl-term": "inl", "inr-term": "inr", tuple: "tuple", first: "1st", second: "2nd",
  leftOperand: "left", rightOperand: "right", head: "head", tail: "tail",
};

// The single text field a double-click edits, per node kind.
function editableField(term: any): {key: string; value: string; parse: (text: string) => unknown} | undefined {
  switch (term?.kind) {
    case "Var": return {key: "name", value: term.name, parse: (text) => text};
    case "Abs": return {key: "param", value: term.param, parse: (text) => text};
    case "Lit": return {key: "value", value: String(term.value), parse: (text) => text};
    case "Let": return {key: "name", value: term.name, parse: (text) => text};
    case "TypeAbs": return {key: "typeParam", value: term.typeParam, parse: (text) => text};
    case "RecordProjection": return {key: "label", value: term.label, parse: (text) => text};
    case "TupleProjection": return {key: "index", value: String(term.index), parse: (text) => Math.max(1, Number(text) || 1)};
    default: return undefined;
  }
}

// A lecture-style node in the AST editor: the textbook label, open child slots as dots to drag from,
// and a double-click to rename where the node has a name.
export function LectureEditableNode({data, selected}: {data: any; selected?: boolean}) {
  const {t} = useTranslation();
  const term = data?.term;
  const field = editableField(term);
  const [draft, setDraft] = useState<string | undefined>();
  const slots = lectureSlots(term).filter((slot) => !TYPE_SLOTS.has(slot));
  const isProgram = term?.kind === "Program";

  const commit = () => {
    if (field && draft !== undefined && draft.trim() !== "" && draft !== field.value) data.onChange?.({[field.key]: field.parse(draft.trim())});
    setDraft(undefined);
  };

  return (
    <div
      onDoubleClick={field && data.onChange ? () => setDraft(field.value) : undefined}
      title={field && data.onChange ? t("astEditor.lectureRename") : undefined}
      className={cn(
        "relative rounded-md border px-1.5 font-serif italic text-xl leading-8 text-foreground whitespace-nowrap transition-colors",
        selected ? "border-sky-500 bg-sky-500/10" : "border-transparent hover:border-border",
        isProgram && "not-italic font-sans text-xs leading-7 text-muted-foreground border-dashed border-muted-foreground/40",
      )}
    >
      {!isProgram && <Handle type="target" position={Position.Top} className="!h-2 !w-2 !min-h-0 !min-w-0 !border !border-background !bg-muted-foreground/60"/>}
      {draft !== undefined ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(undefined);
          }}
          className="nodrag nopan w-24 rounded border bg-background px-1 font-mono text-sm not-italic outline-none focus:ring-1 focus:ring-ring"
        />
      ) : isProgram ? t("astEditor.lectureProgram") : lectureLabel(term)}
      {slots.map((slot, i) => (
        <Handle
          key={slot}
          type="source"
          position={Position.Bottom}
          id={slot}
          title={SLOT_LABELS[slot] ?? slot}
          style={{left: `${((i + 1) / (slots.length + 1)) * 100}%`}}
          className="!h-2 !w-2 !min-h-0 !min-w-0 !border !border-background !bg-sky-500"
        />
      ))}
    </div>
  );
}
