import {useLayoutEffect, useRef, useState} from "react";
import {motion} from "framer-motion";
import {Link, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {MDXProvider} from "@mdx-js/react";
import {TaskScopeContext} from "@/shared/activity/taskTracking.ts";
import {Download} from "lucide-react";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {ComingSoonPanel} from "@/shared/components/ComingSoonPanel.tsx";
import {Callout, MobileTableOfContents, TableOfContents, type TocItem} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";
import {mdxComponents} from "@/features/docs/lectures/mdxComponents.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";
import {extractOutline} from "@/features/docs/lectures/extractOutline.ts";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";
import {resolveLectureContent} from "@/features/docs/lectureContent.ts";
import {usePageMeta, SITE_URL} from "@/shared/hooks/usePageMeta.ts";

export function DocsLecturePage() {
  const {t, i18n} = useTranslation();
  const {slug} = useParams<{slug: string}>();
  const index = LECTURE_REGISTRY.findIndex((l) => l.slug === slug);
  const entry = index === -1 ? undefined : LECTURE_REGISTRY[index];
  // A hidden lecture doesn't exist as far as the reader is concerned — same as no slug match.
  const lecture = entry?.visible ? entry : undefined;
  const text = lecture ? getLectureText(lecture, i18n.language) : undefined;
  const openable = LECTURE_REGISTRY.filter((l) => l.visible && l.openable);
  const nearestOpenable = [...openable.filter((l) => LECTURE_REGISTRY.indexOf(l) < index).reverse(), ...openable.filter((l) => LECTURE_REGISTRY.indexOf(l) > index)][0];
  const resolved = lecture?.openable && slug ? resolveLectureContent(slug, i18n.language) : undefined;

  // Derived from the rendered MDX (see extractOutline.ts) rather than a hand-maintained
  // lectures.config.json field — only knowable once the content's actually in the DOM.
  const contentRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<TocItem[]>([]);
  useLayoutEffect(() => {
    setOutline(contentRef.current ? extractOutline(contentRef.current) : []);
    // `resolved` is a fresh {Component, isFallback} object literal every render (resolveLectureContent
    // isn't memoized) — depending on it directly would re-run this effect, call setOutline, and
    // re-render every time, forever. resolved.Component itself is the cached MDX module export, so
    // it's referentially stable across renders for the same content — safe to depend on.
  }, [resolved?.Component]);

  usePageMeta(
    lecture && text ? `${text.title} — tt Guide` : "Lecture not found — tt",
    text?.summary,
    lecture && text && resolved ? {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: text.title,
      description: text.summary,
      url: `${SITE_URL}/docs/${lecture.slug}`,
      inLanguage: i18n.language,
      isPartOf: {"@type": "WebSite", name: "tt", url: SITE_URL},
    } : undefined,
    // Unwritten lectures and the not-found state are real routes but thin — keep them out of the index.
    {noindex: !lecture || !resolved},
  );

  if (!lecture || !text) {
    return (
      <motion.div initial="initial" animate="animate" variants={fadeInUp} className="space-y-4">
        <h1 className="text-2xl font-bold">{t("docsLecture.notFoundTitle")}</h1>
        <p className="text-muted-foreground">
          {t("docsLecture.notFoundMessage")}{" "}
          <Link to="/docs" className="text-primary hover:underline">{t("docsLecture.backToGuide")}</Link>.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial="initial" animate="animate" variants={fadeInUp}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t("guide.lecture")} {String(index + 1).padStart(2, "0")}
          </p>
          <h1 className="text-3xl font-bold">{text.title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">{text.summary}</p>
        </div>
        {/* Pre-rendered at build time (scripts/gen-lecture-pdfs.mjs), not generated client-side —
            see the PDF-export postmortem in project memory for why. The PDF is filed under
            the locale of the file actually on screen, which differs from the UI language on a fallback. */}
        {resolved && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`/lectures-pdf/${resolved.locale}/${lecture.slug}.pdf`}
                  download
                  className="print:hidden shrink-0 self-start inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Download className="h-4 w-4"/>
                  {t("docsLecture.downloadPdf")}
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("docsLecture.downloadPdfTooltip")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {!resolved ? (
        <ComingSoonPanel
          continueTo={nearestOpenable && {to: `/docs/${nearestOpenable.slug}`, title: getLectureText(nearestOpenable, i18n.language).title}}
        />
      ) : (
        <div className="xl:flex xl:gap-8">
          <div className="space-y-12 min-w-0 flex-1">
            {outline.length > 0 && (
              <MobileTableOfContents items={outline}/>
            )}

            {resolved.isFallback && (
              <Callout title={t("docsLecture.notTranslatedTitle")}>
                {t("docsLecture.notTranslatedMessage", {language: t(`language.${resolved.locale}`, resolved.locale)})}
              </Callout>
            )}

            {/* space-y-12 repeated here, not just on the outer div — MDXProvider renders no DOM
                element of its own, so the MDX's top-level blocks are direct children of this
                div, not of the outer one; without the class here they'd all render flush
                against each other. */}
            <div ref={contentRef} className="space-y-12">
              <TaskScopeContext.Provider value={`lecture:${slug}`}>
                <MDXProvider components={mdxComponents}>
                  <resolved.Component/>
                </MDXProvider>
              </TaskScopeContext.Provider>
            </div>
          </div>

          {outline.length > 0 && (
            <TableOfContents items={outline}/>
          )}
        </div>
      )}
    </motion.div>
  );
}
