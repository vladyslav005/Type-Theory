import {motion} from "framer-motion";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowRight, ScrollText, Sigma} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card.tsx";
import {cn} from "@/shared/lib/utils.ts";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {LECTURE_REGISTRY, getLectureText} from "@/features/docs/lectureRegistry.ts";
import {usePageMeta, SITE_URL} from "@/shared/hooks/usePageMeta.ts";

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export function DocsIndexPage() {
  const {i18n} = useTranslation();
  const visibleLectures = LECTURE_REGISTRY.filter((lecture) => lecture.visible);

  usePageMeta(
    "Guide — tt",
    "A hands-on introduction to typed lambda calculus, taught alongside the app — lectures, a " +
    "typing/evaluation rule reference, and the full grammar and symbol glossary.",
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "tt Type Theory Lectures",
      itemListElement: visibleLectures
        .filter((lecture) => lecture.openable)
        .map((lecture, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: getLectureText(lecture, i18n.language).title,
          url: `${SITE_URL}/docs/${lecture.slug}`,
        })),
    },
  );

  return (
    <div className="space-y-10">
      <motion.div initial="initial" animate="animate" variants={fadeInUp}>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Guide</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          A hands-on introduction to typed lambda calculus, taught alongside this app.
          Each lecture pairs a short concept explanation with concrete steps to try in
          the editor, so the theory and the tool stay attached to each other.
        </p>
      </motion.div>

      <motion.section
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Lectures
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleLectures.map((lecture, index) => {
            const text = getLectureText(lecture, i18n.language);
            const card = (
              <Card
                className={cn(
                  "h-full shadow-sm transition-all duration-200",
                  lecture.openable
                    ? "hover:shadow-md hover:-translate-y-0.5"
                    : "opacity-60 cursor-default",
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg leading-snug">
                      <span className="text-muted-foreground/60 tabular-nums mr-2">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {text.title}
                    </CardTitle>
                    {lecture.openable ? (
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1"/>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground shrink-0 mt-1.5 rounded-full border px-2 py-0.5">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <CardDescription className="leading-relaxed">
                    {text.summary}
                  </CardDescription>
                </CardHeader>
              </Card>
            );

            return (
              <motion.div key={lecture.slug} variants={fadeInUp}>
                {lecture.openable ? <Link to={`/docs/${lecture.slug}`}>{card}</Link> : card}
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Reference
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div variants={fadeInUp}>
            <Link to="/docs/rules">
              <Card className="h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-muted shrink-0">
                    <ScrollText className="h-5 w-5 text-primary"/>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Rules</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every typing and evaluation rule introduced across the lectures, collected into one reference deck.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Link to="/docs/grammar">
              <Card className="h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-muted shrink-0">
                    <Sigma className="h-5 w-5 text-primary"/>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Grammar & Symbols</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The language's grammar in EBNF, plus every special symbol and how to type it.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
