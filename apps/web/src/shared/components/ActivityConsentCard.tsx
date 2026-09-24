import {BarChart3} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Link, useLocation} from "react-router-dom";
import {Button} from "@/shared/components/ui/button.tsx";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/shared/components/ui/dialog.tsx";
import {STUDY_MODE} from "@/shared/activity/studyConfig.ts";
import {setConsent} from "@/shared/activity/activityStore.ts";
import {useActivity} from "@/shared/activity/useActivity.ts";

// A choice is required: both buttons are equally prominent and the dialog can't be dismissed without one.
export function ActivityConsentCard() {
  const {t} = useTranslation();
  const {consent} = useActivity();
  const {pathname} = useLocation();

  const open = STUDY_MODE && consent === "unset" && pathname !== "/activity";

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="print:hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary"/>
            {t("activity.consent.title")}
          </DialogTitle>
          <DialogDescription>{t("activity.consent.body")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {(t("activity.consent.points", {returnObjects: true}) as string[]).map((point) => <li key={point}>{point}</li>)}
        </ul>
        <Link to="/activity" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {t("activity.consent.learnMore")}
        </Link>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="sm:flex-1" onClick={() => setConsent("denied")}>{t("activity.consent.decline")}</Button>
          <Button variant="default" className="sm:flex-1" onClick={() => setConsent("granted")}>{t("activity.consent.allow")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
