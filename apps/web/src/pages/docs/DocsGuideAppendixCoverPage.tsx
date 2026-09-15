import {useTranslation} from "react-i18next";
import {FloatingLambdaSymbols} from "@/shared/components/FloatingLambdaSymbols.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

// Print-only route — exists so scripts/gen-merged-guide.mjs can print a real, app-styled divider
// page as the merged guide's appendix section break, instead of hand-drawing plain centered text
// with pdf-lib (same reasoning as DocsGuideCoverPage.tsx for the title page). Unlike the cover,
// there's no freeform prose to author here — both strings are the existing guide.appendix/
// guide.rulesReference translations (already used for the table of contents), so this stays a
// plain translated component rather than a per-locale .mdx content file that would just restate
// the same two strings a second time.
export function DocsGuideAppendixCoverPage() {
  const {t} = useTranslation();
  usePageMeta("Appendix — tt", undefined, undefined, {noindex: true});

  return (
    <div className="relative overflow-hidden flex min-h-[1010px] flex-col items-center justify-center py-16">
      <FloatingLambdaSymbols/>
      <div className="relative flex flex-col items-center text-center gap-3">
        {/*<div className="rounded-full border px-5 py-2 font-mono text-2xl text-primary">*/}
        {/*  Γ ⊢ t : T*/}
        {/*</div>*/}
        <h1 className="text-6xl font-bold tracking-tight mt-8">{t("guide.appendix")}</h1>
        <div className="w-16 border-t-2 border-primary/40 my-4"/>
        <p className="text-xl text-muted-foreground font-medium">{t("guide.rulesReference")}</p>
      </div>
    </div>
  );
}
