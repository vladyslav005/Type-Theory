import {useState, type ReactNode} from "react";
import {NavLink, Outlet, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {BookOpen, ChevronDown, FlaskConical, GraduationCap, Hourglass, Menu, ScrollText, Sigma, X} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";
import {LAB_REGISTRY, getLabText} from "@/features/docs/labs/labRegistry.ts";

const navLinkClass = ({isActive}: {isActive: boolean}) =>
  cn(
    "block rounded-lg px-3 py-2 text-sm transition-colors duration-150",
    isActive
      ? "bg-primary text-primary-foreground font-medium"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

function SoonMark() {
  const {t} = useTranslation();
  return <Hourglass className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0" aria-label={t("docsIndex.comingSoon")}/>;
}

const COLLAPSE_KEY = "tt-docs-sidebar-collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function SidebarSection({id, icon, title, children}: {id: string; icon?: ReactNode; title: string; children: ReactNode}) {
  const [collapsed, setCollapsed] = useState(() => !!readCollapsed()[id]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify({...readCollapsed(), [id]: next}));
    } catch {
      // storage unavailable: the section still toggles for this visit
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="mb-2 flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        {icon}
        {title}
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}/>
      </button>
      <div
        inert={collapsed}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function SidebarContent({onNavigate}: {onNavigate?: () => void}) {
  const {t, i18n} = useTranslation();
  const visibleLectures = LECTURE_REGISTRY.filter((lecture) => lecture.visible);
  const visibleLabs = LAB_REGISTRY.filter((lab) => lab.visible);

  return (
    <nav className="space-y-6">
      <div>
        <NavLink to="/docs" end className={navLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0"/>
            {t("docsLayout.overview")}
          </span>
        </NavLink>
      </div>

      <SidebarSection id="lectures" icon={<GraduationCap className="h-3.5 w-3.5 shrink-0"/>} title={t("docsLayout.lectures")}>
        <ol className="space-y-1">
          {visibleLectures.map((lecture, index) => (
            <li key={lecture.slug}>
              <NavLink to={`/docs/${lecture.slug}`} className={(state) => cn(navLinkClass(state), !lecture.openable && !state.isActive && "opacity-60")} onClick={onNavigate}>
                <span className="flex gap-2.5">
                  <span className="text-muted-foreground/60 tabular-nums shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {getLectureText(lecture, i18n.language).title}
                  {!lecture.openable && <SoonMark/>}
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
      </SidebarSection>

      {visibleLabs.length > 0 && (
        <SidebarSection id="labs" icon={<FlaskConical className="h-3.5 w-3.5 shrink-0"/>} title={t("docsLayout.labs")}>
          <ol className="space-y-1">
            {visibleLabs.map((lab, index) => (
              <li key={lab.slug}>
                <NavLink to={`/docs/labs/${lab.slug}`} className={(state) => cn(navLinkClass(state), !lab.openable && !state.isActive && "opacity-60")} onClick={onNavigate}>
                  <span className="flex gap-2.5">
                    <span className="text-muted-foreground/60 tabular-nums shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {getLabText(lab, i18n.language).title}
                    {!lab.openable && <SoonMark/>}
                  </span>
                </NavLink>
              </li>
            ))}
          </ol>
        </SidebarSection>
      )}

      <SidebarSection id="reference" title={t("docsLayout.reference")}>
        <div className="space-y-1">
          <NavLink to="/docs/rules" className={navLinkClass} onClick={onNavigate}>
            <span className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 shrink-0"/>
              {t("docsLayout.rules")}
            </span>
          </NavLink>
          <NavLink to="/docs/grammar" className={navLinkClass} onClick={onNavigate}>
            <span className="flex items-center gap-2">
              <Sigma className="h-4 w-4 shrink-0"/>
              {t("docsLayout.grammar")}
            </span>
          </NavLink>
        </div>
      </SidebarSection>
    </nav>
  );
}

export function DocsLayout() {
  const {t} = useTranslation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="pt-16 print:pt-0 min-h-screen bg-gradient-to-b from-background to-muted/40 print:bg-none">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        {/* Mobile nav toggle */}
        <div className="lg:hidden print:hidden mb-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsMobileNavOpen((v) => !v)}
          >
            {isMobileNavOpen ? <X className="h-4 w-4"/> : <Menu className="h-4 w-4"/>}
            {t("docsLayout.menu")}
          </Button>
        </div>

        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10 print:block">
          {/* Sidebar */}
          <aside
            className={cn(
              "lg:block print:hidden",
              isMobileNavOpen ? "block mb-6" : "hidden",
            )}
          >
            <div className="lg:sticky lg:top-24 rounded-xl border bg-card p-4">
              <SidebarContent onNavigate={() => setIsMobileNavOpen(false)}/>
            </div>
          </aside>

          {/* Content */}
          <main key={location.pathname} className="min-w-0">
            <Outlet/>
          </main>
        </div>
      </div>
    </div>
  );
}
