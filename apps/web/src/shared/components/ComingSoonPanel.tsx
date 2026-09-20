import {Link} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Hourglass} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";

export function ComingSoonPanel({kind = "lecture", continueTo, backTo = "/docs"}: {kind?: "lecture" | "lab"; continueTo?: {to: string; title: string}; backTo?: string}) {
  const {t} = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Hourglass className="h-6 w-6 text-muted-foreground"/>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{t(kind === "lab" ? "docsLab.comingSoonTitle" : "docsLecture.comingSoonTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">{t(kind === "lab" ? "docsLab.comingSoonBody" : "docsLecture.comingSoonBody")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {continueTo && (
          <Button asChild size="sm">
            <Link to={continueTo.to}>{t("docsLecture.comingSoonContinue", {title: continueTo.title})}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to={backTo}>{t("docsLecture.backToGuide")}</Link>
        </Button>
      </div>
    </div>
  );
}
