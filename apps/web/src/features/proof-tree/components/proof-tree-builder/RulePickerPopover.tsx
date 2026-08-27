import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import type {ReactNode} from "react";
import {Popover, PopoverContent, PopoverTrigger} from "@/shared/components/ui/popover.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {Rule} from "@vladyslav005/tt-core";
import {useAppDispatch, useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {chooseRule} from "@/shared/ui-state/termSlice.ts";
import {RULE_LABELS, rulesForTheories} from "@/features/proof-tree/components/proof-tree-builder/ruleLabels.ts";

interface RulePickerPopoverProps {
  nodeId: string;
  children: ReactNode;
}

// Rules are gated by whichever theories are currently enabled, and searchable — the full rule set
// is too long to scan as a flat list once every theory is on.
export function RulePickerPopover({nodeId, children}: RulePickerPopoverProps) {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const enabledTheories = useAppSelector((state) => state.term.enabledTheories);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const rules = useMemo(() => rulesForTheories(enabledTheories), [enabledTheories]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((rule) => (RULE_LABELS[rule] ?? rule).toLowerCase().includes(q));
  }, [rules, search]);

  const pick = (rule: Rule) => {
    dispatch(chooseRule({nodeId, rule}));
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) setSearch("");
    }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("proofBuilder.searchRules")}
          className="h-8 text-xs mb-2"
        />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No matching rules</p>
          )}
          {filtered.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => pick(rule)}
              className="w-full text-left font-mono text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors"
            >
              {RULE_LABELS[rule]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
