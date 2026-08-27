import {useEffect} from "react";
import {useTranslation} from "react-i18next";

// Keeps <html lang> in sync with the active language for a11y and SEO.
export function useHtmlLang() {
  const {i18n} = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
  }, [i18n.resolvedLanguage, i18n.language]);
}
