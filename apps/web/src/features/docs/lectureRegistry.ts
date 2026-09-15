import lecturesConfig from "./lectures.config.json";

// No `outline` field — the table of contents (on-page and in the merged PDF) is derived
// straight from the rendered MDX instead, see extractOutline.ts. Keeping it here would just be
// a second hand-maintained copy of what SectionHeading/ConceptSection ids already say.
export interface LectureTranslation {
  title: string;
  summary: string;
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
