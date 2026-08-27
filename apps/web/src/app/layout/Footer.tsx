import {BookType} from "lucide-react";
import {useTranslation} from "react-i18next";

export function Footer() {
  const {t} = useTranslation();
  return (
    <footer className="bg-muted pb-8 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="pt-8 mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <BookType className="w-4 h-4 text-primary-foreground"/>
        </div>
        <span className="font-semibold">{t("footer.brand")}</span>
      </div>
      <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
        <p>{t("footer.rights", {year: new Date().getFullYear()})}</p>
      </div>
    </footer>
  )
}
