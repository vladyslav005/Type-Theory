import lecturesConfig from "./lectures.config.json";
import type {TocItem} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";

export interface LectureTranslation {
  title: string;
  summary: string;
  outline: TocItem[];
}

export interface LectureEntry {
  slug: string;
  // false = fully hidden (excluded from the index and 404s if visited directly).
  visible: boolean;
  // true once a lecture has real content — false shows a "coming soon" state
  // instead of a 404, so a not-yet-written lecture can still be listed.
  openable: boolean;
  translations: Record<string, LectureTranslation>;
}

// Ordered to mirror the app's own build order — each lecture builds on the ones before it.
export const LECTURE_REGISTRY: LectureEntry[] = lecturesConfig.lectures as LectureEntry[];

// Falls back to English, then to whichever single translation exists, for a locale with
// no translation yet — a lecture is never required to have every language (or even English).
export function getLectureText(entry: LectureEntry, locale: string): LectureTranslation {
  return entry.translations[locale] ?? entry.translations.en ?? Object.values(entry.translations)[0];
}
