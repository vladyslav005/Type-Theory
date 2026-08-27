import {Check, Languages} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES} from "@/i18n";

export function LanguageMenu({className}: {className?: string}) {
  const {t, i18n} = useTranslation();
  const active = i18n.resolvedLanguage ?? i18n.language;

  const selectLanguage = (code: string) => {
    void i18n.changeLanguage(code);
    // The language-detector cache can miss on programmatic changes — persist explicitly.
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      /* private mode / storage disabled */
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label={t("language.label")}
        >
          <Languages className="h-4 w-4"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator/>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onSelect={() => selectLanguage(lng.code)}
            className="flex items-center justify-between"
          >
            <span>{lng.label}</span>
            {active === lng.code && <Check className="h-4 w-4"/>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
