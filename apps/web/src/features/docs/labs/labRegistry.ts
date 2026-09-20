import type {ComponentType} from "react";
import labsConfig from "@/features/docs/labs.config.json";

export interface LabTranslation {
  title: string;
  summary: string;
}

export interface LabEntry {
  slug: string;
  visible: boolean;
  // false shows a "coming soon" page instead of the content
  openable: boolean;
  translations: Record<string, LabTranslation>;
}

export const LAB_REGISTRY: LabEntry[] = labsConfig.labs as LabEntry[];

export function getLabText(entry: LabEntry, locale: string): LabTranslation {
  return entry.translations[locale] ?? entry.translations.en ?? Object.values(entry.translations)[0];
}

const modules = import.meta.glob("./content/*/*.mdx", {eager: true}) as Record<
  string,
  {default: ComponentType<Record<string, unknown>>}
>;

export function resolveLabContent(slug: string, locale: string) {
  const prefix = `./content/${slug}/`;
  const path = [`${prefix}${locale}.mdx`, `${prefix}en.mdx`].find((p) => modules[p])
    ?? Object.keys(modules).find((p) => p.startsWith(prefix));
  return path
    ? {Component: modules[path].default, locale: path.slice(prefix.length, -".mdx".length), isFallback: path !== `${prefix}${locale}.mdx`}
    : undefined;
}
