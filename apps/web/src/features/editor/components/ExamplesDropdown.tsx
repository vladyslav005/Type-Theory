import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils.ts";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/reduxHooks.ts";
import { setExamplesTopic } from "@/shared/ui-state/termSlice.ts";
import { EXAMPLE_GROUPS } from "@vladyslav005/tt-core";
import {trackExample} from "@/shared/activity/taskTracking.ts";

interface ExamplesDropdownProps {
  onSelect: (code: string) => void;
  disabled?: boolean;
}

const exampleSlug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// One flat {group, item} row per example, precomputed once — used only by the search filter;
// browsing (no query) renders EXAMPLE_GROUPS directly as per-group submenus instead.
const FLAT_EXAMPLES = EXAMPLE_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ group, item, slug: exampleSlug(item.label) })),
);

// Short forms of the group titles for the topic-filter chip row — the full titles wrap onto
// far too many lines at the dropdown's width.
const GROUP_SHORT_LABELS: Record<string, string> = {
  "Basics": "Basics",
  "Untyped Lambda Calculus": "Untyped",
  "Sums & Variants": "Sums",
  "Tuples & Records": "Tuples",
  "Lists": "Lists",
  "Iso-recursive Types (μ)": "μ-types",
  "Recursion (fix)": "Recursion",
  "Let & Polymorphism": "Let/Poly",
  "System F": "Sys F",
  "System Fω (Type Constructors)": "Sys Fω",
  "System λP (Dependent Types)": "Sys λP",
};

export function ExamplesDropdown({ onSelect, disabled = false }: ExamplesDropdownProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const topic = useAppSelector((state) => state.term.examplesTopic);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const scopedExamples = useMemo(
    () => (topic === "all" ? FLAT_EXAMPLES : FLAT_EXAMPLES.filter(({ group }) => group.title === topic)),
    [topic],
  );
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return scopedExamples.filter(({ group, item, slug }) => {
      const label = t(`examples.items.${slug}.label`, item.label).toLowerCase();
      const description = t(`examples.items.${slug}.description`, item.description).toLowerCase();
      const groupTitle = t(`examples.groups.${group.title}`, group.title).toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery) || groupTitle.includes(normalizedQuery);
    });
  }, [normalizedQuery, scopedExamples, t]);

  // Radix's DropdownMenu.Content doesn't expose onOpenAutoFocus publicly (only onCloseAutoFocus) —
  // it always auto-focuses the first item itself on open. Steal focus back to the search input one
  // frame later, after that default focus has already landed.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={disabled}
          title={disabled ? t("topbar.onlyOnEditor") : undefined}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {t("examples.trigger")}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 bg-popover px-1 pt-1 pb-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={t("examples.searchPlaceholder")}
              className="h-8 pl-7 text-sm"
            />
          </div>

          {/* Persisted (state.term.examplesTopic) so e.g. picking "Untyped Lambda Calculus"
              once keeps its examples one click away — no need to re-open the submenu.
              max-h + overflow caps it at ~2 rows so it can't crowd out the results below,
              however many groups end up in the list. */}
          <div className="mt-1.5 flex max-h-12 flex-wrap gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => dispatch(setExamplesTopic("all"))}
              title={t("examples.allTopics")}
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                topic === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {t("examples.allTopics")}
            </button>
            {EXAMPLE_GROUPS.map((group) => (
              <button
                key={group.title}
                type="button"
                onClick={() => dispatch(setExamplesTopic(group.title))}
                title={t(`examples.groups.${group.title}`, group.title)}
                className={cn(
                  "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  topic === group.title
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t(`examples.groupsShort.${group.title}`, GROUP_SHORT_LABELS[group.title] ?? group.title)}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />

        {normalizedQuery ? (
          results.length > 0 ? (
            results.map(({ group, item, slug }) => (
              <DropdownMenuItem key={slug} onClick={() => { trackExample(slug); onSelect(item.code); }}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{t(`examples.items.${slug}.label`, item.label)}</span>
                  <span className="text-[11px] tracking-wide text-muted-foreground/70 uppercase">
                    {t(`examples.groups.${group.title}`, group.title)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t(`examples.items.${slug}.description`, item.description)}</span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t("examples.noResults")}</div>
          )
        ) : topic === "all" ? (
          EXAMPLE_GROUPS.map((group) => (
            <DropdownMenuSub key={group.title}>
              <DropdownMenuSubTrigger>{t(`examples.groups.${group.title}`, group.title)}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-[70vh] w-72 overflow-y-auto">
                {group.items.map((ex) => {
                  const slug = exampleSlug(ex.label);
                  return (
                    <DropdownMenuItem key={ex.label} onClick={() => { trackExample(slug); onSelect(ex.code); }}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{t(`examples.items.${slug}.label`, ex.label)}</span>
                        <span className="text-xs text-muted-foreground">{t(`examples.items.${slug}.description`, ex.description)}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        ) : (
          // A topic chip is active — go straight to its items, no submenu hop needed.
          scopedExamples.map(({ item, slug }) => (
            <DropdownMenuItem key={slug} onClick={() => { trackExample(slug); onSelect(item.code); }}>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t(`examples.items.${slug}.label`, item.label)}</span>
                <span className="text-xs text-muted-foreground">{t(`examples.items.${slug}.description`, item.description)}</span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
