import {motion} from "framer-motion";
import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCode,
  FileDown,
  Layers,
  Network,
  Play,
  Scale,
  ScrollText,
  Shapes,
  Sigma,
  Sparkles,
  GitBranch,
} from "lucide-react";
import {Button} from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {FloatingLambdaSymbols} from "@/shared/components/FloatingLambdaSymbols.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

const fadeInUp = {
  initial: {opacity: 0, y: 20},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.5},
};

const staggerContainer = {
  animate: {transition: {staggerChildren: 0.1}},
};

// Flip to true to bring the Technology Stack section back.
const SHOW_TECH_STACK = false;

const FEATURE_ICONS = {
  CheckCircle2, Sparkles, Play, Network, Layers, GitBranch, ClipboardCheck, Shapes, Scale, FileDown,
} as const;

const FEATURE_KEYS = [
  {icon: "CheckCircle2", key: "typeChecking"},
  {icon: "Sparkles", key: "typeInference"},
  {icon: "Play", key: "evaluation"},
  {icon: "Network", key: "proofTree"},
  {icon: "Layers", key: "ast"},
  {icon: "GitBranch", key: "synchronized"},
  {icon: "ClipboardCheck", key: "exercises"},
  {icon: "Shapes", key: "theories"},
  {icon: "Scale", key: "curryHoward"},
  {icon: "FileDown", key: "latex"},
] as const satisfies ReadonlyArray<{icon: keyof typeof FEATURE_ICONS; key: string}>;

const EXPLORE = [
  {icon: BookOpen, key: "basics", to: "/docs/stlc-basics"},
  {icon: ScrollText, key: "rules", to: "/docs/rules"},
  {icon: Sigma, key: "grammar", to: "/docs/grammar"},
] as const;

export function HomePage() {
  const {t} = useTranslation();
  usePageMeta(t("home.metaTitle"));

  return (
    <div className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/40">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <FloatingLambdaSymbols />

        <motion.section
          className="container mx-auto px-4 py-16 md:py-24 max-w-4xl text-center"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("home.heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto leading-relaxed">
            {t("home.heroLead")}
          </p>
          <p className="text-sm md:text-base text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            {t("home.heroSub")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-2xl shadow-lg w-full sm:w-auto">
              <Link to="/main">
                {t("home.ctaOpen")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-2xl w-full sm:w-auto">
              <Link to="/docs">{t("home.ctaGuide")}</Link>
            </Button>
          </div>
          <div className="mt-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
              <FileCode className="mr-2 h-4 w-4" />
              {t("home.readThesis")}
            </Button>
          </div>
        </motion.section>
      </div>

      {/* Project Overview */}
      <motion.section
        className="container mx-auto px-4 py-8 pb-16 max-w-6xl"
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{delay: 0.2, duration: 0.5}}
      >
        <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-2xl sm:text-3xl">{t("home.overviewTitle")}</CardTitle>
            <CardDescription className="text-base">
              {t("home.overviewSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <motion.div
              className="grid gap-6 md:grid-cols-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {FEATURE_KEYS.map(({icon, key}) => {
                const Icon = FEATURE_ICONS[icon];
                return (
                  <motion.div
                    key={key}
                    className="flex gap-4 p-6 rounded-2xl hover:bg-muted/50 transition-all duration-300 group"
                    variants={fadeInUp}
                  >
                    <div className="flex-shrink-0">
                      <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors duration-300">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">
                        {t(`home.features.${key}.title`)}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(`home.features.${key}.description`)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Explore the guide */}
      <section className="container mx-auto px-4 pb-20 max-w-6xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
          {t("home.exploreHeading")}
        </h2>
        <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
          {t("home.exploreLead")}
        </p>

        <div className="grid gap-6 sm:grid-cols-3">
          {EXPLORE.map(({icon: Icon, key, to}) => (
            <Link key={key} to={to} className="group">
              <Card className="h-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <CardHeader>
                  <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-2 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg flex items-center gap-1.5">
                    {t(`home.explore.${key}.title`)}
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </CardTitle>
                  <CardDescription className="leading-relaxed">
                    {t(`home.explore.${key}.desc`)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Technology Stack Section */}
      {SHOW_TECH_STACK && (
      <motion.section
        className="container mx-auto px-4 py-12 pb-20 max-w-6xl"
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.6, duration: 0.5}}
      >
        <h2 className="text-3xl font-bold mb-8 text-center">Technology Stack</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {icon: "⚛️", title: "React 19", description: "Modern UI with hooks, concurrent rendering, and component-driven architecture."},
            {icon: "⚡", title: "Vite", description: "Fast dev server and optimized production builds."},
            {icon: "📘", title: "TypeScript", description: "Type-safe codebase with strong editor tooling and refactoring support."},
            {icon: "🧠", title: "Redux Toolkit", description: "Predictable state management for editor, AST, and proof-related UI state."},
            {icon: "🧩", title: "shadcn/ui + Radix UI", description: "Accessible UI primitives and consistent design system components."},
            {icon: "🎨", title: "Tailwind CSS", description: "Utility-first styling with theming support and small bundle footprint."},
            {icon: "🗺️", title: "React Flow (@xyflow/react)", description: "Graph-based visualization used for interactive AST layout and editing."},
            {icon: "📝", title: "Monaco Editor", description: "Code editor experience for textual lambda calculus input."},
            {icon: "🔧", title: "ANTLR4", description: "Lexer/parser generation for the term language and AST construction."},
            {icon: "🧪", title: "Zod", description: "Schema validation for safer runtime boundaries and structured data."},
            {icon: "✨", title: "Framer Motion", description: "Animations and transitions for a smoother exploratory experience."},
            {icon: "📐", title: "Dagre", description: "Automatic graph layout for cleaner AST and derivation visualizations."},
            {icon: "🔍", title: "MathJax", description: "Renders judgements and typing rules as real math in the browser."},
            {icon: "🖐️", title: "react-zoom-pan-pinch", description: "Pan/zoom for exploring large proof trees and AST graphs."},
            {icon: "🧱", title: "ESLint", description: "Static analysis and consistency checks during development."},
          ].map((tech, idx) => (
            <motion.div
              key={idx}
              initial={{opacity: 0, scale: 0.9}}
              animate={{opacity: 1, scale: 1}}
              transition={{delay: 0.7 + idx * 0.05, duration: 0.25}}
            >
              <Card className="h-full shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-default">
                <CardHeader>
                  <div className="text-4xl mb-2">{tech.icon}</div>
                  <CardTitle className="text-lg flex items-center gap-2">{tech.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{tech.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>
      )}
    </div>
  );
}
