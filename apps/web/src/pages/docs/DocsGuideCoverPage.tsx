import {MDXProvider} from "@mdx-js/react";
import {useTranslation} from "react-i18next";
import {resolveGuideCover} from "@/features/docs/guide/guideCoverContent.ts";
import {mdxComponents} from "@/features/docs/lectures/mdxComponents.tsx";
import {FloatingLambdaSymbols} from "@/shared/components/FloatingLambdaSymbols.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

// Print-only route — exists so scripts/gen-merged-guide.mjs can print a real, app-styled page
// as the merged guide's title page instead of hand-drawing one with pdf-lib. Not linked from
// any nav and kept out of the sitemap; visiting it directly on-screen works too, it's just not
// meant to be discovered that way.
//
// The decorative framing (floating background symbols, spacing) lives here rather than in the
// cover .mdx files so those stay purely the content a non-developer would want to edit — title,
// subtitle, authors. One file per locale (cover.en.mdx, ...), same pattern as lecture content;
// gen-merged-guide.mjs sets the "tt-lang" locale before navigating here, same as a lecture route.
export function DocsGuideCoverPage() {
  const {i18n} = useTranslation();
  usePageMeta("Guide Cover — tt", undefined, undefined, {noindex: true});
  // Kept behind a property access, not a bare `const CoverContent = ...`, so it reads the same
  // way resolveLectureContent's result does in DocsLecturePage.tsx (react-hooks/static-components
  // flags a PascalCase variable reassigned from a function call in render as a risk of remounting
  // on every render — a member expression like this one doesn't trip that check).
  const cover = {Component: resolveGuideCover(i18n.language)};

  return (
    <div className="relative overflow-hidden flex min-h-[1010px] flex-col items-center justify-center py-16">
      <FloatingLambdaSymbols/>
      <div className="relative">
        <MDXProvider components={mdxComponents}>
          <cover.Component/>
        </MDXProvider>
      </div>
    </div>
  );
}
