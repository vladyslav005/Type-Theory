import {useState} from "react";
import {useTranslation} from "react-i18next";
import {useRouteError, useNavigate} from "react-router-dom";
import {AlertTriangle, ChevronDown, ChevronUp} from "lucide-react";
import {Button} from "@/shared/components/ui/button.tsx";
import i18n from "@/i18n";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "statusText" in error &&
    typeof (error as {statusText: unknown}).statusText === "string"
  ) {
    return (error as {statusText: string}).statusText;
  }
  return i18n.t("errorPage.fallbackMessage");
}

function getStackTrace(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack;
  return null;
}

export function ErrorPage() {
  const {t} = useTranslation();
  const error = useRouteError();
  const navigate = useNavigate();
  const [stackOpen, setStackOpen] = useState(false);

  const stack = getStackTrace(error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">

        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-3xl animate-pulse"/>
            <div className="relative w-32 h-32 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-16 h-16 text-destructive animate-bounce"/>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-2xl sm:text-3xl font-semibold text-foreground">
            {t("errorPage.title")}
          </p>
        </div>

        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {getErrorMessage(error)}
        </p>

        {stack && (
          <div className="text-left">
            <button
              onClick={() => setStackOpen(o => !o)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              {stackOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
              {stackOpen ? t("errorPage.hideStack") : t("errorPage.showStack")}
            </button>

            {stackOpen && (
              <pre className="mt-3 p-4 rounded-lg bg-muted border border-border text-xs text-left text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                {stack}
              </pre>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => navigate(-1)} variant="outline">
            {t("errorPage.goBack")}
          </Button>
          <Button onClick={() => window.location.reload()}>
            {t("errorPage.reload")}
          </Button>
        </div>

        <div className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {t("errorPage.persists")}{" "}
            <a
              href="https://github.com/vladyslav005/tt/issues"
              className="text-primary hover:underline"
            >
              {t("errorPage.openIssue")}
            </a>
            .
          </p>
        </div>

      </div>
    </div>
  );
}
