import {motion} from "framer-motion";
import {Link, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {MDXProvider} from "@mdx-js/react";
import {BookOpen, Download} from "lucide-react";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {Callout, MobileTableOfContents, TableOfContents} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";
import {mdxComponents} from "@/features/docs/lectures/mdxComponents.tsx";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";
import {resolveLectureContent} from "@/features/docs/lectureContent.ts";
import {usePageMeta, SITE_URL} from "@/shared/hooks/usePageMeta.ts";

export function DocsLecturePage() {
  const {i18n} = useTranslation();
  const {slug} = useParams<{slug: string}>();
  const index = LECTURE_REGISTRY.findIndex((l) => l.slug === slug);
  const entry = index === -1 ? undefined : LECTURE_REGISTRY[index];
  // A hidden lecture doesn't exist as far as the reader is concerned — same as no slug match.
  const lecture = entry?.visible ? entry : undefined;
  const text = lecture ? getLectureText(lecture, i18n.language) : undefined;
  const resolved = lecture?.openable && slug ? resolveLectureContent(slug, i18n.language) : undefined;

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
        <h1 className="text-2xl font-bold">Lecture not found</h1>
        <p className="text-muted-foreground">
          There's no lecture at this address. <Link to="/docs" className="text-primary hover:underline">Back to the Guide</Link>.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial="initial" animate="animate" variants={fadeInUp}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            Lecture {String(index + 1).padStart(2, "0")}
          </p>
          <h1 className="text-3xl font-bold">{text.title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">{text.summary}</p>
        </div>
        {/* Pre-rendered at build time (scripts/gen-lecture-pdfs.mjs), not generated client-side —
            see the PDF-export postmortem in project memory for why. isFallback ⇒ the on-screen
            content is the English file, so the generated PDF is filed under "en" too. */}
        {resolved && (
          <a
            href={`/lectures-pdf/${resolved.isFallback ? "en" : i18n.language}/${lecture.slug}.pdf`}
            download
            className="print:hidden shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Download className="h-4 w-4"/>
            Download PDF
          </a>
        )}
      </div>

      {!resolved ? (
        <EmptyState
          icon={BookOpen}
          message="This lecture hasn't been written yet — check back soon."
          className="min-h-64"
        />
      ) : (
        <div className="xl:flex xl:gap-8">
          <div className="space-y-12 min-w-0 flex-1">
            {text.outline.length > 0 && (
              <MobileTableOfContents items={text.outline}/>
            )}

            {resolved.isFallback && (
              <Callout title="Not yet translated">
                This lecture isn't translated into your language yet — showing the English version.
              </Callout>
            )}

            <MDXProvider components={mdxComponents}>
              <resolved.Component/>
            </MDXProvider>
          </div>

          {text.outline.length > 0 && (
            <TableOfContents items={text.outline}/>
          )}
        </div>
      )}
    </motion.div>
  );
}
