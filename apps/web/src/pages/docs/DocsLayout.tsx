import {useState} from "react";
import {NavLink, Outlet, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {BookOpen, Menu, ScrollText, Sigma, X} from "lucide-react";
import {cn} from "@/shared/lib/utils.ts";
import {Button} from "@/shared/components/ui/button.tsx";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";

const navLinkClass = ({isActive}: {isActive: boolean}) =>
  cn(
    "block rounded-lg px-3 py-2 text-sm transition-colors duration-150",
    isActive
      ? "bg-primary text-primary-foreground font-medium"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

function SidebarContent({onNavigate}: {onNavigate?: () => void}) {
  const {i18n} = useTranslation();
  const visibleLectures = LECTURE_REGISTRY.filter((lecture) => lecture.visible);

  return (
    <nav className="space-y-6">
      <div>
        <NavLink to="/docs" end className={navLinkClass} onClick={onNavigate}>
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0"/>
            Overview
          </span>
        </NavLink>
      </div>

      <div>
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lectures
        </p>
        <ol className="space-y-1">
          {visibleLectures.map((lecture, index) => (
            <li key={lecture.slug}>
              <NavLink to={`/docs/${lecture.slug}`} className={navLinkClass} onClick={onNavigate}>
                <span className="flex gap-2.5">
                  <span className="text-muted-foreground/60 tabular-nums shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {getLectureText(lecture, i18n.language).title}
                </span>
              </NavLink>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reference
        </p>
        <div className="space-y-1">
          <NavLink to="/docs/rules" className={navLinkClass} onClick={onNavigate}>
            <span className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 shrink-0"/>
              Rules
            </span>
          </NavLink>
          <NavLink to="/docs/grammar" className={navLinkClass} onClick={onNavigate}>
            <span className="flex items-center gap-2">
              <Sigma className="h-4 w-4 shrink-0"/>
              Grammar & Symbols
            </span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export function DocsLayout() {
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
            Guide Menu
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
