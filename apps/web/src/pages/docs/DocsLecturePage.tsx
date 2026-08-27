import {motion} from "framer-motion";
import {Link, useParams} from "react-router-dom";
import {BookOpen} from "lucide-react";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {EmptyState} from "@/shared/components/EmptyState.tsx";
import {LECTURE_REGISTRY} from "@/features/docs/lectureRegistry.ts";
import {LECTURE_CONTENT} from "@/features/docs/lectureContentRegistry.tsx";
import {usePageMeta, SITE_URL} from "@/shared/hooks/usePageMeta.ts";

export function DocsLecturePage() {
  const {slug} = useParams<{slug: string}>();
  const index = LECTURE_REGISTRY.findIndex((l) => l.slug === slug);
  const lecture = index === -1 ? undefined : LECTURE_REGISTRY[index];
  const Content = slug ? LECTURE_CONTENT[slug] : undefined;

  usePageMeta(
    lecture ? `${lecture.title} — tt Guide` : "Lecture not found — tt",
    lecture?.summary,
    lecture ? {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: lecture.title,
      description: lecture.summary,
      url: `${SITE_URL}/docs/${lecture.slug}`,
      inLanguage: "en",
      isPartOf: {"@type": "WebSite", name: "tt", url: SITE_URL},
    } : undefined,
  );

  if (!lecture) {
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
    <motion.div initial="initial" animate="animate" variants={fadeInUp} className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">
          Lecture {String(index + 1).padStart(2, "0")}
        </p>
        <h1 className="text-3xl font-bold">{lecture.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">{lecture.summary}</p>
      </div>

      {Content ? (
        <Content/>
      ) : (
        <EmptyState
          icon={BookOpen}
          message="This lecture hasn't been written yet — check back soon."
          className="min-h-64"
        />
      )}
    </motion.div>
  );
}
