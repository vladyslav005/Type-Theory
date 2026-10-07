import {useState} from "react";
import {useTranslation} from "react-i18next";
import {AlertTriangle, RotateCcw, Settings2} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";
import {Tip} from "@/shared/components/Tip.tsx";

export interface LimitField {
  label: string;
  hint: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
}

const clamp = (field: LimitField, text: string) => {
  const n = Number(text);
  return text.trim() !== "" && Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, Math.round(n))) : field.value;
};

// A gear in a panel header for limits that trade completeness against the risk of freezing the page.
// Edits are drafts until Apply, so a half-typed number never takes effect; resets apply at once.
export function LimitSettingsPopover({title, fields, warning, note, onApply}: {
  title: string;
  fields: LimitField[];
  warning: string;
  note?: string;
  onApply: (values: number[]) => void;
}) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const isDefault = fields.every((field) => field.value === field.defaultValue);
  const draftsAreDefault = fields.every((field, i) => clamp(field, drafts[i] ?? "") === field.defaultValue);
  const changed = fields.some((field, i) => clamp(field, drafts[i] ?? "") !== field.value);

  const onOpenChange = (next: boolean) => {
    if (next) setDrafts(fields.map((field) => String(field.value)));
    setOpen(next);
  };
  const apply = () => {
    onApply(fields.map((field, i) => clamp(field, drafts[i] ?? "")));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tip label={open ? undefined : title}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="relative shrink-0" aria-label={title}>
            <Settings2 className="h-5 w-5"/>
            {!isDefault && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500"/>}
          </Button>
        </PopoverTrigger>
      </Tip>
      <PopoverContent align="end" className="w-72 flex flex-col gap-3">
        <p className="text-sm font-medium">{title}</p>
        {fields.map((field, i) => (
          <label key={field.label} className="flex flex-col gap-1">
            <span className="flex items-center justify-between gap-2 text-xs font-medium">
              {field.label}
              {fields.length > 1 && clamp(field, drafts[i] ?? "") !== field.defaultValue && (
                <Tip label={t("limitSettings.resetOne", {value: field.defaultValue})}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setDrafts((current) => current.map((d, j) => (j === i ? String(field.defaultValue) : d)));
                      onApply(fields.map((other, j) => (j === i ? other.defaultValue : other.value)));
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("limitSettings.resetOne", {value: field.defaultValue})}
                  >
                    <RotateCcw className="h-3 w-3"/>
                  </button>
                </Tip>
              )}
            </span>
            <input
              value={drafts[i] ?? ""}
              onChange={(e) => setDrafts((current) => current.map((d, j) => (j === i ? e.target.value.replace(/[^\d]/g, "") : d)))}
              onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
              inputMode="numeric"
              className="h-8 rounded border border-input bg-background px-2 font-mono text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[11px] text-muted-foreground">{field.hint}</span>
          </label>
        ))}
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px"/>
          {warning}
        </p>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            disabled={draftsAreDefault && isDefault}
            onClick={() => {
              setDrafts(fields.map((field) => String(field.defaultValue)));
              onApply(fields.map((field) => field.defaultValue));
            }}
          >
            <RotateCcw className="h-3.5 w-3.5"/>
            {t(fields.length > 1 ? "limitSettings.resetAll" : "limitSettings.reset")}
          </Button>
          <Button size="sm" disabled={!changed} onClick={apply}>{t("limitSettings.apply")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
