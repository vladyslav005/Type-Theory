import {useTranslation} from "react-i18next";
import {BookOpen, ExternalLink} from "lucide-react";
import {getLectureText, LECTURE_REGISTRY} from "@/features/docs/lectureRegistry.ts";
import {getLabText, LAB_REGISTRY} from "@/features/docs/labs/labRegistry.ts";
import type {LearnLink} from "@/features/tour/tours.ts";

interface ResolvedLink {
  href: string;
  kind: string;
  title: string;
}

export function LearnLinks({links, heading}: {links: LearnLink[]; heading: string}) {
  const {t, i18n} = useTranslation();

  const resolved = links.flatMap((link): ResolvedLink[] => {
    if ("lecture" in link) {
      const entry = LECTURE_REGISTRY.find((e) => e.slug === link.lecture && e.visible && e.openable);
      return entry ? [{href: `/docs/${entry.slug}`, kind: t("tour.learn.lecture"), title: getLectureText(entry, i18n.language).title}] : [];
    }
    if ("lab" in link) {
      const entry = LAB_REGISTRY.find((e) => e.slug === link.lab && e.visible && e.openable);
      return entry ? [{href: `/docs/labs/${entry.slug}`, kind: t("tour.learn.lab"), title: getLabText(entry, i18n.language).title}] : [];
    }
    return [{href: `/docs/${link.page}`, kind: t("tour.learn.reference"), title: t(`home.explore.${link.page}.title`)}];
  });
  if (resolved.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border bg-muted/40 px-2.5 py-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-foreground"><BookOpen className="h-3.5 w-3.5"/>{heading}</p>
      <p className="mt-0.5 text-muted-foreground">{t("tour.learn.newTab")}</p>
      <ul className="mt-1.5 space-y-1">
        {resolved.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener" className="group inline-flex items-start gap-1 text-primary hover:underline">
              <span className="text-muted-foreground">{link.kind}:</span>
              <span>{link.title}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60"/>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
