import {useMemo, useState} from "react";
import {motion} from "framer-motion";
import {Search, X} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {CURRY_HOWARD_CORRESPONDENCE, EVALUATION_RULE_GROUPS, TYPE_RULE_GROUPS, type CurryHowardPair, type RuleDefinition, type RuleGroup} from "@/features/docs/rules/ruleDefinitions.ts";
import {RuleCard} from "@/features/docs/rules/RuleCard.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Pairs each type-rule topic with its evaluation-rule counterpart(s) so a topic's
// "does this typecheck" and "how does it run" rules sit together on the page,
// instead of in two separate top-level buckets. Topics with no operational
// semantics of their own (logic, kinding, inference) simply have no eval groups.
// `label` is the short form used by the category filter chips.
const TOPIC_PAIRINGS: {typeId: string; label: string; evalIds: string[]}[] = [
  {typeId: "stlc", label: "STLC", evalIds: ["stlc-eval"]},
  {typeId: "curry-howard", label: "Curry–Howard", evalIds: []},
  {typeId: "data-types", label: "Tuples & Variants", evalIds: ["data-types-eval", "lists-eval"]},
  {typeId: "iso-recursive", label: "Iso-recursive", evalIds: ["iso-recursive-eval"]},
  {typeId: "recursion", label: "Recursion", evalIds: ["recursion-eval"]},
  {typeId: "let-polymorphism", label: "Let & Inference", evalIds: []},
  {typeId: "system-f", label: "System F", evalIds: ["system-f-eval"]},
  {typeId: "system-f-omega", label: "System Fω", evalIds: []},
  {typeId: "system-lambda-p", label: "System λP", evalIds: []},
];

function ruleMatches(rule: RuleDefinition, groupTitle: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = `${rule.id} ${rule.id.replace(/-/g, "")} ${rule.description} ${groupTitle}`.toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

function filterGroup(group: RuleGroup, terms: string[]): RuleGroup | null {
  const rules = group.rules.filter((r) => ruleMatches(r, group.title, terms));
  return rules.length > 0 ? {...group, rules} : null;
}

function pairMatches(pair: CurryHowardPair, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [
    pair.concept, pair.note,
    pair.program.id, pair.program.id.replace(/-/g, ""), pair.program.description,
    pair.logic.id, pair.logic.description,
    "curry howard correspondence proofs propositions natural deduction",
  ].join(" ").toLowerCase();
  return terms.every((t) => haystack.includes(t));
}

const CURRY_HOWARD_ID = "curry-howard";

function CurryHowardCorrespondence({pairs}: {pairs: CurryHowardPair[]}) {
  return (
    <motion.div
      className="space-y-4"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      <div className="hidden lg:grid lg:grid-cols-[1fr_2.5rem_1fr] lg:gap-4 px-1">
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">A term of type…</span>
        <span/>
        <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">…is a proof of</span>
      </div>
      {pairs.map((pair) => (
        <motion.div
          key={pair.concept}
          variants={fadeInUp}
          className="rounded-xl border bg-card/40 p-4 space-y-3"
        >
          <h4 className="text-center text-sm font-semibold">{pair.concept}</h4>
          <div className="grid gap-3 lg:grid-cols-[1fr_2.5rem_1fr] lg:items-center lg:gap-4">
            <RuleCard rule={pair.program} className="h-full"/>
            <div className="flex items-center justify-center text-xl text-muted-foreground" aria-label="corresponds to">≅</div>
            <RuleCard rule={pair.logic} className="h-full"/>
          </div>
          <p className="mx-auto max-w-3xl text-center text-sm text-muted-foreground leading-relaxed">{pair.note}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function RuleGrid({rules}: {rules: RuleDefinition[]}) {
  return (
    // Two columns, not three — inference-rule formulas need real width before
    // they'll stay on one line. Dense packing backfills the gap a wide (full-row)
    // card leaves behind with the next short card instead of leaving it empty.
    <motion.div
      className="grid grid-flow-dense gap-4 lg:grid-cols-2"
      initial="initial"
      animate="animate"
      variants={staggerContainer}
    >
      {rules.map((rule) => (
        <motion.div
          key={rule.id}
          variants={fadeInUp}
          className={cn(rule.wide && "lg:col-span-2")}
        >
          <RuleCard rule={rule} className="h-full"/>
        </motion.div>
      ))}
    </motion.div>
  );
}

function RuleSubsection({label, groups}: {label: string; groups: RuleGroup[]}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">{label}</h3>
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id}>
            {group.note && (
              <p className="text-sm text-muted-foreground mb-4 max-w-3xl leading-relaxed">{group.note}</p>
            )}
            <RuleGrid rules={group.rules}/>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocsRulesPage() {
  usePageMeta(
    "Rules Reference — tt",
    "Every typing and evaluation rule referenced across the lectures, grouped by the concept that " +
    "introduces it, in the same premises-over-conclusion form the Proof Tree panel builds live.",
  );

  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

  const terms = useMemo(
    () => query.toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );

  const sections = useMemo(() => {
    type Section =
      | {kind: "rules"; typeId: string; title: string; note?: string; typeGroup: RuleGroup | null; evalGroups: RuleGroup[]}
      | {kind: "curry-howard"; typeId: string; title: string; note?: string; pairs: CurryHowardPair[]};

    return TOPIC_PAIRINGS
      .filter(({typeId}) => activeCategories.size === 0 || activeCategories.has(typeId))
      .map(({typeId, evalIds}): Section | null => {
        const typeGroup = TYPE_RULE_GROUPS.find((g) => g.id === typeId);
        if (!typeGroup) return null;

        if (typeId === CURRY_HOWARD_ID) {
          const pairs = CURRY_HOWARD_CORRESPONDENCE.filter((p) => pairMatches(p, terms));
          if (pairs.length === 0) return null;
          return {kind: "curry-howard", typeId, title: typeGroup.title, note: typeGroup.note, pairs};
        }

        const filteredType = filterGroup(typeGroup, terms);
        const filteredEval = evalIds
          .map((id) => EVALUATION_RULE_GROUPS.find((g) => g.id === id))
          .filter((g): g is RuleGroup => g !== undefined)
          .map((g) => filterGroup(g, terms))
          .filter((g): g is RuleGroup => g !== null);

        if (!filteredType && filteredEval.length === 0) return null;
        return {kind: "rules", typeId, title: typeGroup.title, note: typeGroup.note, typeGroup: filteredType, evalGroups: filteredEval};
      })
      .filter((s): s is Section => s !== null);
  }, [terms, activeCategories]);

  const matchCount = useMemo(
    () => sections.reduce((n, s) => {
      if (s.kind === "curry-howard") return n + s.pairs.length * 2;
      return n + (s.typeGroup?.rules.length ?? 0) + s.evalGroups.reduce((m, g) => m + g.rules.length, 0);
    }, 0),
    [sections],
  );

  const filtersActive = query.trim().length > 0 || activeCategories.size > 0;

  function toggleCategory(id: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setActiveCategories(new Set());
  }

  return (
    <div className="space-y-8">
      <motion.div initial="initial" animate="animate" variants={fadeInUp}>
        <h1 className="text-3xl font-bold">Rules</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Every typing and evaluation rule referenced across the lectures, grouped by the
          concept that introduces it — type rules first, then how that same construct
          evaluates. Premises sit above the line, the conclusion below — exactly like the
          derivations the Proof Tree panel builds live.
        </p>
      </motion.div>

      <div className="print:hidden sticky top-16 z-10 -mx-1 space-y-3 border-b bg-background/85 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules by name or description…"
            className="pl-9"
            aria-label="Search rules"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TOPIC_PAIRINGS.map(({typeId, label}) => {
            const active = activeCategories.has(typeId);
            return (
              <button
                key={typeId}
                type="button"
                onClick={() => toggleCategory(typeId)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3"/>
              Clear
            </button>
          )}
        </div>

        {filtersActive && (
          <p className="text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "rule" : "rules"} match
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No rules match the current filters.
        </p>
      ) : (
        <div className="space-y-14">
          {sections.map((section) => (
            <section key={section.typeId}>
              <h2 className="text-xl font-bold mb-1">{section.title}</h2>
              {section.note && (
                <p className="text-sm text-muted-foreground mb-6 max-w-3xl leading-relaxed">{section.note}</p>
              )}

              {section.kind === "curry-howard" ? (
                <CurryHowardCorrespondence pairs={section.pairs}/>
              ) : (
                <div className="space-y-8">
                  {section.typeGroup && (
                    // The topic note already renders above the section heading — drop it here.
                    <RuleSubsection label="Type Rules" groups={[{...section.typeGroup, note: undefined}]}/>
                  )}
                  {section.evalGroups.length > 0 && (
                    <RuleSubsection label="Evaluation Rules" groups={section.evalGroups}/>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
