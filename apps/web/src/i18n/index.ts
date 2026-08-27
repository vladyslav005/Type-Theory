import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en/common.json";
import sk from "./locales/sk/common.json";
import uk from "./locales/uk/common.json";

export const SUPPORTED_LANGUAGES = [
  {code: "en", label: "English"},
  {code: "sk", label: "Slovenčina"},
  {code: "uk", label: "Українська"},
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_STORAGE_KEY = "tt-lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {common: en},
      sk: {common: sk},
      uk: {common: uk},
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    load: "languageOnly",
    ns: ["common"],
    defaultNS: "common",
    interpolation: {escapeValue: false},
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
