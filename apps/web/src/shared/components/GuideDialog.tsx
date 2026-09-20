import {CircleHelp} from "lucide-react";
import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button.tsx";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/shared/components/ui/dialog.tsx";

const withCode = (text: string) =>
  text.split("`").map((part, i) =>
    i % 2 === 1
      ? <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{part}</code>
      : part,
  );

interface GuideDialogProps {
  i18nPrefix: string;
  steps: readonly string[];
}

export function GuideDialog({i18nPrefix, steps}: GuideDialogProps) {
  const {t} = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={t(`${i18nPrefix}.open`)} title={t(`${i18nPrefix}.open`)}>
          <CircleHelp className="h-4 w-4"/>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${i18nPrefix}.title`)}</DialogTitle>
          <DialogDescription>{t(`${i18nPrefix}.intro`)}</DialogDescription>
        </DialogHeader>
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {steps.map((k, i) => (
            <li key={k} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div className="space-y-0.5 text-sm">
                <p className="font-medium">{t(`${i18nPrefix}.steps.${k}.title`)}</p>
                <p className="text-muted-foreground">{withCode(t(`${i18nPrefix}.steps.${k}.body`))}</p>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
