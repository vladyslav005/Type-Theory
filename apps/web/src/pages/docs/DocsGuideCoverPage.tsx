import {MDXProvider} from "@mdx-js/react";
import CoverContent from "@/features/docs/guide/cover.mdx";
import {mdxComponents} from "@/features/docs/lectures/mdxComponents.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";

// Print-only route — exists so scripts/gen-merged-guide.mjs can print a real, app-styled page
// as the merged guide's title page instead of hand-drawing one with pdf-lib. Not linked from
// any nav and kept out of the sitemap; visiting it directly on-screen works too, it's just not
// meant to be discovered that way.
export function DocsGuideCoverPage() {
  usePageMeta("Guide Cover — tt", undefined, undefined, {noindex: true});

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-16">
      <MDXProvider components={mdxComponents}>
        <CoverContent/>
      </MDXProvider>
    </div>
  );
}
