import {BookType} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";

export function Footer() {
  const {t} = useTranslation();
  return (
    <footer className="print:hidden bg-muted py-4 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <BookType className="w-3 h-3 text-primary-foreground"/>
          </span>
          {t("footer.brand")}
        </span>
        <span aria-hidden="true">·</span>
        <span>{t("footer.rights", {year: new Date().getFullYear()})}</span>
        <span aria-hidden="true">·</span>
        <span>
          {t("footer.basedOn")}{" "}
          <a
            href="https://kurzy.kpi.fei.tuke.sk/tt/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("footer.courseLink")}
          </a>
        </span>
        {STUDY_MODE && (
          <>
            <span aria-hidden="true">·</span>
            <Link to="/activity" className="underline underline-offset-2 hover:text-foreground">{t("footer.activity")}</Link>
          </>
        )}
      </div>
    </footer>
  )
}
