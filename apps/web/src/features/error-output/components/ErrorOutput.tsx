import {useTranslation} from "react-i18next";
import {cn} from "@/shared/lib/utils.ts";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";
import {Card, CardContent} from "@/shared/components/ui/card.tsx";
import {motion} from "framer-motion";
import {useContext, useEffect, useMemo, type RefObject} from "react";
import type {TextEditorHandle} from "@/features/editor/components/TextEditor.tsx";
import {errorPosition} from "@/shared/lib/errorPosition.ts";
import {severityOf, type OutputSeverity} from "@/shared/ui-state/termSlice.ts";
import {markOutputVisible} from "@/shared/ui-state/outputPanel.ts";
import {OUTPUT_TOAST_ID} from "@/features/error-output/useOutputToasts.ts";
import {toast} from "sonner";
import {ViewVisibleContext} from "@/shared/activity/activityClock.ts";
import {AlertTriangle, Info} from "lucide-react";

const SEVERITY_ORDER: Record<OutputSeverity, number> = {error: 0, warning: 1, info: 2};

export interface ErrorOutputProps {
  className?: string;
  editorRef?: RefObject<TextEditorHandle | null>;
}

// eslint-disable-next-line react-refresh/only-export-components -- shared across many feature components
export const fadeInUp = {
  initial: {opacity: 0, y: 10},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.3},
};

export function ErrorOutput({
  className,
  editorRef,
} : ErrorOutputProps) {

  const {t} = useTranslation();
  const messages = useAppSelector((state) => state.term.processingErrors);
  const visible = useContext(ViewVisibleContext);
  const entries = useMemo(() => {
    let errorNumber = 0;
    return (messages ?? [])
      .map((error) => ({error, severity: severityOf(error)}))
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .map((entry) => ({...entry, number: entry.severity === "error" ? ++errorNumber : 0}));
  }, [messages]);

  useEffect(() => {
    if (!visible) return;
    toast.dismiss(OUTPUT_TOAST_ID);
    return markOutputVisible();
  }, [visible]);

  // A rebuild can remove the hovered row without a mouseleave, so drop any highlight it left behind.
  useEffect(() => {
    const editor = editorRef?.current;
    return () => editor?.highlightRange?.(null);
  }, [messages, editorRef]);

  return (
    <motion.div
      className={cn(className)}
      initial="initial"
      animate="animate"
      variants={fadeInUp}
    >
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        <CardContent className="pt-6 flex-1 overflow-auto">
          {entries.length > 0 ? (
            <div className="space-y-3">
              {entries.map(({error, severity, number}, index) => {
                const pos = editorRef ? errorPosition(error) : undefined;
                return (
                <motion.div
                  key={index}
                  initial={{opacity: 0, x: -10}}
                  animate={{opacity: 1, x: 0}}
                  transition={{delay: index * 0.05, duration: 0.3}}
                  className={cn(
                    "flex gap-3 p-4 rounded-xl border transition-colors duration-200",
                    severity === "info"
                      ? "bg-sky-500/5 border-sky-500/25 hover:bg-sky-500/10"
                      : severity === "warning"
                        ? "bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10"
                        : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10",
                  )}
                  onMouseEnter={pos ? () => editorRef?.current?.highlightRange?.(pos, "error") : undefined}
                  onMouseLeave={pos ? () => editorRef?.current?.highlightRange?.(null) : undefined}
                >
                  <div className="shrink-0 mt-0.5">
                    {severity === "info" ? (
                      <div className="w-6 h-6 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-600 dark:text-sky-400">
                        <Info className="h-3.5 w-3.5"/>
                      </div>
                    ) : severity === "warning" ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5"/>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-xs font-semibold">
                        {number}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed flex-1">
                    {error.message}
                  </p>
                  {pos && (
                    <span className="shrink-0 self-start mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {pos.line}:{pos.column + 1}
                    </span>
                  )}
                </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center rounded-xl bg-muted/30 border">
              <p className="text-sm text-muted-foreground">
                {t("errorsPanel.empty")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}