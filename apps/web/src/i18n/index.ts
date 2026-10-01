import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en/common.json";

export const SUPPORTED_LANGUAGES = [
  {code: "en", label: "English"},
  {code: "sk", label: "Slovenčina"},
  {code: "uk", label: "Українська"},
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "tt-lang";

const lazyLocales: Record<string, () => Promise<{default: object}>> = {
  sk: () => import("./locales/sk/common.json"),
  uk: () => import("./locales/uk/common.json"),
};

export const i18nReady = i18n
  .use(LanguageDetector)
  .use({
    type: "backend",
    read: (lng: string, _ns: string, callback: (err: unknown, data: object | null) => void) => {
      const load = lazyLocales[lng];
      if (!load) return callback(null, {});
      load().then((m) => callback(null, m.default), (err) => callback(err, null));
    },
  })
  .use(initReactI18next)
  .init({
    resources: {en: {common: en}},
    // English is bundled as the fallback; other locales are fetched by the backend above.
    partialBundledLanguages: true,
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    load: "languageOnly",
    ns: ["common"],
    defaultNS: "common",
    interpolation: {escapeValue: false},
    react: {useSuspense: false},
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lngs, _ns, key) => console.warn(`[i18n] missing key "${key}" for ${lngs.join(", ")}`)
      : undefined,
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
