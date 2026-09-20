import {motion} from "framer-motion";
import {Link, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {MDXProvider} from "@mdx-js/react";
import {fadeInUp} from "@/features/error-output/components/ErrorOutput.tsx";
import {Callout} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";
import {LAB_REGISTRY, getLabText, resolveLabContent} from "@/features/docs/labs/labRegistry.ts";
import {labMdxComponents} from "@/features/docs/labs/labComponents.tsx";
import {ComingSoonPanel} from "@/shared/components/ComingSoonPanel.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

export function DocsLabPage() {
  const {t, i18n} = useTranslation();
  const {slug} = useParams<{slug: string}>();
  const index = LAB_REGISTRY.findIndex((lab) => lab.slug === slug);
  const lab = index === -1 || !LAB_REGISTRY[index].visible ? undefined : LAB_REGISTRY[index];
  const text = lab && getLabText(lab, i18n.language);
  const openable = LAB_REGISTRY.filter((l) => l.visible && l.openable);
  const nearestOpenable = [...openable.filter((l) => LAB_REGISTRY.indexOf(l) < index).reverse(), ...openable.filter((l) => LAB_REGISTRY.indexOf(l) > index)][0];
  const resolved = lab?.openable && slug ? resolveLabContent(slug, i18n.language) : undefined;

  usePageMeta(text ? `${text.title} — tt Labs` : "Lab not found — tt", text?.summary, undefined, {noindex: true});

  if (!lab || !text || (lab.openable && !resolved)) {
    return (
      <motion.div initial="initial" animate="animate" variants={fadeInUp}>
        <h1 className="text-2xl font-bold mb-2">{t("docsLab.notFoundTitle")}</h1>
        <p className="text-muted-foreground">
          {t("docsLab.notFoundMessage")}{" "}
          <Link to="/docs" className="text-primary hover:underline">{t("docsLecture.backToGuide")}</Link>.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div initial="initial" animate="animate" variants={fadeInUp} className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">
          {t("docsLab.lab")} {String(index + 1).padStart(2, "0")}
        </p>
        <h1 className="text-3xl font-bold">{text.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">{text.summary}</p>
      </div>

      {!resolved && (
        <ComingSoonPanel
          kind="lab"
          continueTo={nearestOpenable && {to: `/docs/labs/${nearestOpenable.slug}`, title: getLabText(nearestOpenable, i18n.language).title}}
        />
      )}

      {resolved?.isFallback && (
        <Callout title={t("docsLecture.notTranslatedTitle")}>
          {t("docsLecture.notTranslatedMessage", {language: t(`language.${resolved.locale}`, resolved.locale)})}
        </Callout>
      )}

      {resolved && (
        <div className="space-y-6">
          <MDXProvider components={labMdxComponents}>
            <resolved.Component/>
          </MDXProvider>
        </div>
      )}
    </motion.div>
  );
}
