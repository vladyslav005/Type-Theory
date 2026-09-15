import type {ComponentType} from "react";

// The merged guide's title-page content, one file per locale — e.g. "./cover.en.mdx". Same
// pattern as lectureContent.ts's per-(slug, locale) resolution, just for a single fixed page
// instead of one per lecture. Falls back to English when the requested locale has no file yet.
const modules = import.meta.glob("./cover.*.mdx", {eager: true}) as Record<
  string,
  {default: ComponentType<Record<string, unknown>>}
>;

export function resolveGuideCover(locale: string): ComponentType<Record<string, unknown>> {
  const preferred = `./cover.${locale}.mdx`;
  return (modules[preferred] ?? modules["./cover.en.mdx"]).default;
}
