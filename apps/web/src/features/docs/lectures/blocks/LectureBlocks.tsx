import {useEffect, useState, type ReactNode} from "react";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {MathJax} from "better-react-mathjax";
import {ArrowRight, BookOpen, ChevronDown, ListTree, Sparkles} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {RuleCard} from "@/features/docs/rules/RuleCard.tsx";
import {findRule, type RuleDefinition} from "@/features/docs/rules/ruleDefinitions.ts";

// Real LaTeX in lecture prose — inline within a sentence: <Math>{"\\Gamma \\vdash t : T"}</Math>,
// or as its own centered equation: <MathBlock>{"\\mathit{fix}\\ g = g\\ (\\mathit{fix}\\ g)"}</MathBlock>.
// Deliberately the same MathJax pipeline every rule card and evaluation step already uses
// (MathJaxContext in AppProviders.tsx) rather than a second static renderer (e.g. rehype-katex)
// bolted onto the MDX pipeline — that would render differently, and this app already paid the
// cost of making MathJax itself behave correctly on-screen and in the PDF export.
export function Math({children}: {children: string}) {
  return <MathJax inline>{`\\(${children}\\)`}</MathJax>;
}

export function MathBlock({children}: {children: string}) {
  return <MathJax>{`\\[${children}\\]`}</MathJax>;
}

// Chapter-level heading (Syntax / Typing / Semantics); ConceptSection nests under it.
// scroll-mt-24 keeps anchored/scrolled-to headings clear of the fixed top bar.
// data-toc-level/data-toc-title (only when there's an id to link to) are how extractOutline.ts
// derives the on-page TOC and the merged PDF's table of contents straight from this rendered
// content, instead of from a hand-maintained duplicate list in lectures.config.json.
export function SectionHeading({id, index, title, blurb}: {id?: string; index: string; title: string; blurb: string}) {
  return (
    <div
      id={id}
      className="scroll-mt-24 flex items-start gap-4"
      {...(id ? {"data-toc-level": "1", "data-toc-title": title} : {})}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-bold">
        {index}
      </span>
      <div className="pt-1">
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">{blurb}</p>
      </div>
    </div>
  );
}

export function ConceptSection({id, title, children}: {id?: string; title: string; children: ReactNode}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-3 border-l-2 border-primary/20 pl-5 ml-5"
      {...(id ? {"data-toc-level": "2", "data-toc-title": title} : {})}
    >
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export interface TocItem {
  id: string;
  label: string;
  subitems?: {id: string; label: string}[];
}

// Right-rail "on this page" nav — highlights whichever heading is currently topmost in view.
export function TableOfContents({items}: {items: TocItem[]}) {
  const {t} = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.flatMap((item) => [item.id, ...(item.subitems ?? []).map((s) => s.id)]);
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topmost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
        setActiveId(topmost.target.id);
      },
      {rootMargin: "-100px 0px -70% 0px", threshold: 0},
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  const linkClass = (id: string, sub?: boolean) =>
    cn(
      "block py-1 border-l-2 pl-3 -ml-px transition-colors",
      sub ? "text-xs" : "text-sm",
      activeId === id
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
    );

  return (
    <nav aria-label={t("lectureBlocks.onThisPage")} className="hidden xl:block print:hidden w-52 shrink-0">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 pl-3">{t("lectureBlocks.onThisPage")}</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className={linkClass(item.id)}>{item.label}</a>
              {item.subitems && item.subitems.length > 0 && (
                <ul>
                  {item.subitems.map((sub) => (
                    <li key={sub.id}>
                      <a href={`#${sub.id}`} className={cn(linkClass(sub.id, true), "ml-3")}>{sub.label}</a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// Collapsible "on this page" nav for viewports too narrow for the sticky right rail —
// placed at the top of the article, since a below-the-fold TOC on mobile is dead weight.
export function MobileTableOfContents({items}: {items: TocItem[]}) {
  const {t} = useTranslation();
  return (
    <details className="group xl:hidden print:hidden rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold min-h-11">
        <span className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-muted-foreground"/>
          {t("lectureBlocks.onThisPage")}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"/>
      </summary>
      <ul className="max-h-64 overflow-y-auto px-2 pb-3">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              {item.label}
            </a>
            {item.subitems && item.subitems.length > 0 && (
              <ul>
                {item.subitems.map((sub) => (
                  <li key={sub.id}>
                    <a href={`#${sub.id}`} className="block rounded-md py-1.5 pl-6 pr-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
                      {sub.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export interface PipelineStep {
  label: string;
  detail: string;
}

export function PipelineDiagram({steps}: {steps: PipelineStep[]}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3 rounded-xl border bg-muted/10 p-4 print:break-inside-avoid">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          <div className="flex flex-col items-center justify-center rounded-lg border bg-background px-4 py-2.5 min-w-[7rem] text-center">
            <span className="text-sm font-semibold">{step.label}</span>
            <span className="text-xs text-muted-foreground">{step.detail}</span>
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1"/>}
        </div>
      ))}
    </div>
  );
}

// Unlabeled example rule, teaching the premises/line/conclusion convention before real ones show up.
// Wraps text that points at an interactive widget (print:hidden) so no dangling "try it below" reaches a PDF.
export function ScreenOnly({children}: {children: ReactNode}) {
  return <div className="space-y-4 print:hidden">{children}</div>;
}

export function RuleAnatomy() {
  const {t} = useTranslation();
  return (
    <div className="rounded-xl border bg-muted/10 p-4 flex flex-col items-center gap-1.5 print:break-inside-avoid">
      <span className="text-sm text-muted-foreground">{t("lectureWidgets.anatomy.premise1")}&nbsp;&nbsp;&nbsp;&nbsp;{t("lectureWidgets.anatomy.premise2")}&nbsp;&nbsp;&nbsp;&nbsp;...</span>
      <div className="flex items-center gap-2 w-full max-w-xs">
        <div className="flex-1 border-t border-foreground/50"/>
        <span className="text-xs italic text-muted-foreground whitespace-nowrap">{t("lectureWidgets.anatomy.name")}</span>
      </div>
      <span className="text-sm font-medium">{t("lectureWidgets.anatomy.conclusion")}</span>
      <p className="text-xs text-muted-foreground text-center mt-2 max-w-sm leading-relaxed">
        {t("lectureWidgets.anatomy.note")}
      </p>
    </div>
  );
}

// Always points at something to click in the live app ("open the Editor", "switch to the
// Proof Tree panel") — meaningless once printed, so it's print:hidden rather than just
// print:break-inside-avoid like the other boxed blocks.
export function TryItBox({steps}: {steps: ReactNode[]}) {
  const {t} = useTranslation();
  return (
    <div className="rounded-xl border bg-muted/20 p-4 print:hidden">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">{t("lectureBlocks.tryIt")}</p>
      <ol className="space-y-2.5 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {i + 1}
            </span>
            <span className="text-muted-foreground leading-relaxed pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface InlineRule {
  id: string;
  premises?: string[];
  conclusion: string;
  description?: string;
  wide?: boolean;
}

// `rules` defines lecture-local rules (e.g. NBL) inline; an axiom keeps the (empty) premise line, as in the rules appendix; `descriptions` overrides the (English)
// registry text of `ruleIds` entries so a translated lecture can show its own wording.
export function RuleCardStrip({ruleIds = [], rules: inline = [], descriptions = {}, wide}: {
  ruleIds?: string[];
  rules?: InlineRule[];
  descriptions?: Record<string, string>;
  wide?: boolean;
}) {
  const {t} = useTranslation();
  const registered = ruleIds
    .map(findRule)
    .filter((r): r is RuleDefinition => Boolean(r))
    .map((r) => ({...r, description: descriptions[r.id] ?? r.description}));
  const local: RuleDefinition[] = inline.map((r) => ({
    id: r.id,
    premisesTex: r.premises ?? [""],
    conclusionTex: r.conclusion,
    description: r.description ?? "",
    wide: r.wide,
  }));
  const rules = [...registered, ...local];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("lectureBlocks.rules")}</p>
        {ruleIds.length > 0 && (
          <Link to="/docs/rules" className="text-xs text-muted-foreground hover:text-foreground hover:underline print:hidden">
            {t("lectureBlocks.fullReference")}
          </Link>
        )}
      </div>
      <div className={cn("grid gap-4", wide ? "" : "sm:grid-cols-2")}>
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} className={rule.wide ? "sm:col-span-2" : undefined}/>
        ))}
      </div>
    </div>
  );
}

export interface TraceStep {
  term: string;
  rule?: string;
}

// Plain-text reduction: each row is a term, with the rule that produced it on the right.
// `[[...]]` in a term underlines the redex about to be reduced.
export function ReductionTrace({steps, title}: {steps: TraceStep[]; title?: string}) {
  const {t} = useTranslation();
  const renderTerm = (term: string) =>
    term.split(/\[\[|\]\]/).map((part, i) =>
      i % 2 === 1
        ? <span key={i} className="underline decoration-primary decoration-2 underline-offset-4">{part}</span>
        : <span key={i}>{part}</span>,
    );

  return (
    <div className="rounded-xl border bg-muted/10 p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title ?? t("lectureWidgets.trace")}</p>
      <ol className="space-y-2 font-mono text-sm">
        {steps.map((step, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="w-4 shrink-0 text-muted-foreground">{i === 0 ? "" : "→"}</span>
            <span className="min-w-0 break-words">{renderTerm(step.term)}</span>
            {step.rule && <span className="ml-auto text-xs italic text-muted-foreground font-serif">{step.rule}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Introduces one piece of the app's own UI at a time — a small aside, not a manual dump.
// Not every Callout is app-specific (e.g. a translation-fallback notice reuses it too), so
// hiding it from the printed PDF is an explicit per-usage opt-in, not automatic — pass
// screenOnly on the ones that point at a panel, dropdown, or button in the live app.
export function Callout({title, children, screenOnly}: {title: string; children: ReactNode; screenOnly?: boolean}) {
  return (
    <div className={cn(
      "flex gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 print:break-inside-avoid",
      screenOnly && "print:hidden",
    )}>
      <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5"/>
      <div className="text-sm space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function GrammarBox({grammar, title}: {grammar: string; title?: string}) {
  const {t} = useTranslation();
  return (
    <div className="rounded-xl border bg-muted/10 p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title ?? t("lectureBlocks.grammarCoveredSoFar")}</p>
      <pre className="font-mono text-sm overflow-x-auto leading-relaxed">{grammar}</pre>
    </div>
  );
}

export interface SummaryPoint {
  label: string;
  detail: string;
}

export function SummaryBox({id, points, next}: {id?: string; points: SummaryPoint[]; next?: ReactNode}) {
  const {t} = useTranslation();
  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-xl border bg-muted/10 p-4 print:break-inside-avoid"
      {...(id ? {"data-toc-level": "1", "data-toc-title": t("lectureBlocks.summary")} : {})}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{t("lectureBlocks.summary")}</p>
      <ul className="space-y-1.5 text-sm">
        {points.map((point) => (
          <li key={point.label}>
            <strong className="text-foreground">{point.label}</strong>{" "}
            <span className="text-muted-foreground">— {point.detail}</span>
          </li>
        ))}
      </ul>
      {next && <p className="text-sm text-muted-foreground mt-3 pt-3 border-t print:hidden">{next}</p>}
    </div>
  );
}

export interface ReferenceEntry {
  label: string;
  href: string;
}

export function ReferenceList({id, entries}: {id?: string; entries: ReferenceEntry[]}) {
  const {t} = useTranslation();
  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-xl border border-dashed bg-transparent p-4 print:break-inside-avoid"
      {...(id ? {"data-toc-level": "1", "data-toc-title": t("lectureBlocks.sources")} : {})}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground"/>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("lectureBlocks.sourcesForThisText")}</p>
      </div>
      <ol className="space-y-1.5 text-sm list-decimal list-inside marker:text-muted-foreground marker:text-xs">
        {entries.map((entry) => (
          <li key={entry.href}>
            <a
              href={entry.href}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
