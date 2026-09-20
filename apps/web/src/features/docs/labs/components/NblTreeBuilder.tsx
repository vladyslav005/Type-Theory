import {useTranslation} from "react-i18next";
import type {NblKind} from "@vladyslav005/tt-core";
import {ARITY, emptySlot, type Slot} from "@/features/docs/labs/components/nblTreeModel.ts";

const KINDS: NblKind[] = ["true", "false", "zero", "succ", "pred", "iszero", "if"];
const LABELS: Record<NblKind, string> = {true: "true", false: "false", zero: "0", succ: "succ", pred: "pred", iszero: "iszero", if: "if"};
const IF_CHILDREN = ["cond", "then", "else"] as const;

function SlotView({slot, role, onChange}: {slot: Slot; role?: string; onChange: (next: Slot) => void}) {
  const {t} = useTranslation();

  const pick = (kind: string) => {
    if (!kind) return onChange(emptySlot());
    const next = kind as NblKind;
    onChange({kind: next, children: Array.from({length: ARITY[next]}, emptySlot)});
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {role && <span className="w-10 shrink-0 text-xs text-muted-foreground">{role}</span>}
        <select
          value={slot.kind ?? ""}
          onChange={(e) => pick(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">{t("labWidgets.pickNode")}</option>
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>{LABELS[kind]}</option>
          ))}
        </select>
      </div>
      {slot.children.length > 0 && (
        <div className="ml-3 space-y-1.5 border-l pl-4">
          {slot.children.map((child, i) => (
            <SlotView
              key={i}
              slot={child}
              role={slot.kind === "if" ? IF_CHILDREN[i] : undefined}
              onChange={(next) => onChange({...slot, children: slot.children.map((c, j) => (j === i ? next : c))})}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NblTreeBuilder({slot, onChange}: {slot: Slot; onChange: (next: Slot) => void}) {
  return <SlotView slot={slot} onChange={onChange}/>;
}
