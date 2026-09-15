import {useEffect, useState, type ReactNode} from "react";
import {Link} from "react-router-dom";
import {ArrowRight, BookOpen, ChevronDown, ListTree, Sparkles} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {RuleCard} from "@/features/docs/rules/RuleCard.tsx";
import {findRule} from "@/features/docs/rules/ruleDefinitions.ts";

// Chapter-level heading (Syntax / Typing / Semantics); ConceptSection nests under it.
// scroll-mt-24 keeps anchored/scrolled-to headings clear of the fixed top bar.
export function SectionHeading({id, index, title, blurb}: {id?: string; index: string; title: string; blurb: string}) {
  return (
    <div id={id} className="scroll-mt-24 flex items-start gap-4">
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
    <section id={id} className="scroll-mt-24 space-y-3 border-l-2 border-primary/20 pl-5 ml-5">
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
    <nav aria-label="On this page" className="hidden xl:block print:hidden w-52 shrink-0">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 pl-3">On this page</p>
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
  return (
    <details className="group xl:hidden print:hidden rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold min-h-11">
        <span className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-muted-foreground"/>
          On this page
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
export function RuleAnatomy() {
  return (
    <div className="rounded-xl border bg-muted/10 p-4 flex flex-col items-center gap-1.5 print:break-inside-avoid">
      <span className="text-sm text-muted-foreground">premise 1&nbsp;&nbsp;&nbsp;&nbsp;premise 2&nbsp;&nbsp;&nbsp;&nbsp;...</span>
      <div className="flex items-center gap-2 w-full max-w-xs">
        <div className="flex-1 border-t border-foreground/50"/>
        <span className="text-xs italic text-muted-foreground whitespace-nowrap">rule name</span>
      </div>
      <span className="text-sm font-medium">conclusion</span>
      <p className="text-xs text-muted-foreground text-center mt-2 max-w-sm leading-relaxed">
        Read bottom-up: <strong>if</strong> every premise above the line holds,{" "}
        <strong>then</strong> the conclusion below it holds. The italic label is just the rule's
        name — like a citation, not part of the logic.
      </p>
    </div>
  );
}

export function TryItBox({steps}: {steps: ReactNode[]}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">Try it</p>
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

export function RuleCardStrip({ruleIds}: {ruleIds: string[]}) {
  const rules = ruleIds.map(findRule).filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Rules</p>
        <Link to="/docs/rules" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Full reference →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule}/>
        ))}
      </div>
    </div>
  );
}

// Introduces one piece of the app's own UI at a time — a small aside, not a manual dump.
export function Callout({title, children}: {title: string; children: ReactNode}) {
  return (
    <div className="flex gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-4 print:break-inside-avoid">
      <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5"/>
      <div className="text-sm space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <div className="text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function GrammarBox({grammar, title = "Grammar covered so far"}: {grammar: string; title?: string}) {
  return (
    <div className="rounded-xl border bg-muted/10 p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      <pre className="font-mono text-sm overflow-x-auto leading-relaxed">{grammar}</pre>
    </div>
  );
}

export interface SummaryPoint {
  label: string;
  detail: string;
}

export function SummaryBox({id, points, next}: {id?: string; points: SummaryPoint[]; next?: ReactNode}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-xl border bg-muted/10 p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Summary</p>
      <ul className="space-y-1.5 text-sm">
        {points.map((point) => (
          <li key={point.label}>
            <strong className="text-foreground">{point.label}</strong>{" "}
            <span className="text-muted-foreground">— {point.detail}</span>
          </li>
        ))}
      </ul>
      {next && <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">{next}</p>}
    </div>
  );
}

export interface ReferenceEntry {
  label: string;
  href: string;
}

export function ReferenceList({id, entries}: {id?: string; entries: ReferenceEntry[]}) {
  return (
    <div id={id} className="scroll-mt-24 rounded-xl border border-dashed bg-transparent p-4 print:break-inside-avoid">
      <div className="flex items-center gap-1.5 mb-2.5">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground"/>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources for this text</p>
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
