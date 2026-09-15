import type {ComponentType} from "react";

// Every lecture's prose+widgets file, one per (slug, locale) — e.g.
// "./lectures/stlc-basics/en.mdx". Adding a new lecture or translation is just
// dropping a file here; nothing in this module needs to change.
// Eager (not React.lazy/Suspense): TableOfContents' scroll-spy IntersectionObserver looks
// for heading ids in the DOM as soon as it mounts, so the content needs to already be
// rendered by then, not still loading — fine while there's a handful of lectures; revisit
// if the catalogue grows large enough for bundle size to matter.
const modules = import.meta.glob("./lectures/*/*.mdx", {eager: true}) as Record<
  string,
  {default: ComponentType<Record<string, unknown>>}
>;

export interface ResolvedLectureContent {
  Component: ComponentType<Record<string, unknown>>;
  // True when the requested locale had no file and this is some other locale's file instead.
  isFallback: boolean;
}

export function resolveLectureContent(slug: string, locale: string): ResolvedLectureContent | undefined {
  const preferred = `./lectures/${slug}/${locale}.mdx`;
  if (modules[preferred]) {
    return {Component: modules[preferred].default, isFallback: false};
  }

  // No file for the requested locale — prefer English, then whichever single
  // translation exists (a lecture is never required to have English at all).
  const prefix = `./lectures/${slug}/`;
  const englishFallback = `${prefix}en.mdx`;
  const fallback = modules[englishFallback]
    ? englishFallback
    : Object.keys(modules).find((path) => path.startsWith(prefix));

  if (!fallback) {
    return undefined;
  }

  return {
    Component: modules[fallback].default,
    isFallback: true,
  };
}
