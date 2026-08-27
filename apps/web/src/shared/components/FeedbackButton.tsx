import {MessageSquarePlus} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";

export function FeedbackButton() {
  const {t} = useTranslation();
  return (
    <div className="fixed bottom-20 left-[-10px] z-40 hidden sm:block">
      <Link
        to="/feedback"
        aria-label={t("feedback.aria")}
        className="group flex items-center gap-2 rounded-r-lg bg-primary py-2.5 pl-4 pr-2.5 text-sm font-medium text-primary-foreground shadow-lg -translate-x-[calc(100%-2.75rem)] transition-transform duration-300 ease-out hover:translate-x-0 focus-visible:translate-x-0 focus-visible:outline-none"
      >
        <span>{t("feedback.button")}</span>
        <MessageSquarePlus className="size-5 shrink-0"/>
      </Link>
    </div>
  );
}
