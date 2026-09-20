import {useState} from "react";
import {Bug} from "lucide-react";
import {useTranslation} from "react-i18next";
import {BugReportDialog} from "@/shared/components/BugReportDialog.tsx";

export function BugReportButton() {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="fixed bottom-32 left-[-10px] z-40 hidden sm:block print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("bugReport.aria")}
          className="group flex items-center gap-2 rounded-r-lg bg-primary py-2.5 pl-4 pr-2.5 text-sm font-medium text-primary-foreground shadow-lg -translate-x-[calc(100%-2.75rem)] transition-transform duration-300 ease-out hover:translate-x-0 focus-visible:translate-x-0 focus-visible:outline-none"
        >
          <span>{t("bugReport.button")}</span>
          <Bug className="size-5 shrink-0"/>
        </button>
      </div>
      <BugReportDialog open={open} onOpenChange={setOpen}/>
    </>
  );
}
