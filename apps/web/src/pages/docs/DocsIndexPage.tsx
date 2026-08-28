import {motion} from "framer-motion";
import {Link} from "react-router-dom";
import {ArrowRight, ScrollText, Sigma} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card.tsx";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {LECTURE_REGISTRY} from "@/features/docs/lectureRegistry.ts";
import {LECTURE_CONTENT} from "@/features/docs/lectureContentRegistry.tsx";
import {usePageMeta, SITE_URL} from "@/shared/hooks/usePageMeta.ts";

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export function DocsIndexPage() {
  usePageMeta(
    "Guide — tt",
    "A hands-on introduction to typed lambda calculus, taught alongside the app — lectures, a " +
    "typing/evaluation rule reference, and the full grammar and symbol glossary.",
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "tt Type Theory Lectures",
      itemListElement: LECTURE_REGISTRY
        .filter((lecture) => lecture.slug in LECTURE_CONTENT)
        .map((lecture, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: lecture.title,
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
          {LECTURE_REGISTRY.map((lecture, index) => (
            <motion.div key={lecture.slug} variants={fadeInUp}>
              <Link to={`/docs/${lecture.slug}`}>
                <Card className="h-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg leading-snug">
                        <span className="text-muted-foreground/60 tabular-nums mr-2">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {lecture.title}
                      </CardTitle>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1"/>
                    </div>
                    <CardDescription className="leading-relaxed">
                      {lecture.summary}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          ))}
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
