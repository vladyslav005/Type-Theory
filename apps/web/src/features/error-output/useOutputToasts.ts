import {useEffect, useRef} from "react";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {severityOf} from "@/shared/ui-state/termSlice.ts";
import {isOutputVisible, openOutput} from "@/shared/ui-state/outputPanel.ts";

export const OUTPUT_TOAST_ID = "output";

// Points at errors/warnings the student can't see because the Output panel is hidden.
// Same problems as last time never re-toast, and auto-build is left alone (it would fire on every keystroke).
export function useOutputToasts() {
  const {t} = useTranslation();
  const messages = useAppSelector((state) => state.term.processingErrors);
  const busy = useAppSelector((state) => state.term.building || state.term.evaluating);
  const autoBuild = useAppSelector((state) => state.term.autoBuild);
  const lastShown = useRef("");

  useEffect(() => {
    if (busy) return;
    const problems = (messages ?? []).filter((m) => severityOf(m) !== "info");
    if (problems.length === 0) {
      lastShown.current = "";
      toast.dismiss(OUTPUT_TOAST_ID);
      return;
    }
    const signature = problems.map((m) => m.message).join("\n");
    if (autoBuild || isOutputVisible() || signature === lastShown.current) return;
    lastShown.current = signature;

    const errors = problems.filter((m) => severityOf(m) === "error").length;
    const title = errors > 0
      ? t("outputToast.errors", {count: errors})
      : t("outputToast.warnings", {count: problems.length});
    const first = problems.find((m) => severityOf(m) === "error") ?? problems[0];
    const description = first.message.length > 140 ? `${first.message.slice(0, 140)}…` : first.message;
    (errors > 0 ? toast.error : toast.warning)(title, {
      id: OUTPUT_TOAST_ID,
      description,
      duration: 6000,
      action: {label: t("outputToast.open"), onClick: openOutput},
    });
  }, [messages, busy, autoBuild, t]);
}
