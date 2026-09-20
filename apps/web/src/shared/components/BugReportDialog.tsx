import {useState} from "react";
import {useTranslation} from "react-i18next";
import {toast} from "sonner";
import {Button} from "@/shared/components/ui/button";
import {Input} from "@/shared/components/ui/input";
import {Label} from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {useAppSelector} from "@/shared/hooks/reduxHooks.ts";

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const stringify = (value: unknown) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Error) return {name: v.name, message: v.message};
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[circular]";
      seen.add(v);
    }
    return v;
  }, 2);
};

export function BugReportDialog({open, onOpenChange}: {open: boolean; onOpenChange: (open: boolean) => void}) {
  const {t, i18n} = useTranslation();
  const term = useAppSelector((s) => s.term);
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [attachState, setAttachState] = useState(true);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const attachments: {name: string; type: string; base64: string}[] = [];
      if (attachState) {
        const {buildMode, ast, evaluation, termText} = term;
        const entries: [string, string | undefined][] = [
          ["program.tt", termText],
          ["ast.json", ast && stringify(ast)],
          ["evaluation.json", evaluation && stringify(evaluation)],
          ["student-proof-trees.json", buildMode.active ? stringify({...buildMode, answerKey: undefined}) : undefined],
        ];
        for (const [name, content] of entries) {
          if (content) attachments.push({name, type: name.endsWith(".json") ? "application/json" : "text/plain", base64: toBase64(content)});
        }
      }
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          description,
          contact,
          website,
          files: attachments,
          context: {
            url: location.href,
            userAgent: navigator.userAgent,
            language: i18n.resolvedLanguage,
            viewport: `${innerWidth}x${innerHeight}`,
            enabledTheories: term.enabledTheories,
            evaluationStrategy: term.evaluationStrategy,
            errors: [
              ...(term.processingErrors ?? []).map((e) => e.message),
              ...term.errorMarkers.map((m) => m.message),
            ],
          },
        }),
      });
      if (res.status === 413) {
        toast.error(t("bugReport.tooLarge"));
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      toast.success(t("bugReport.sent"));
      setDescription("");
      onOpenChange(false);
    } catch {
      toast.error(t("bugReport.failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bugReport.title")}</DialogTitle>
          <DialogDescription>{t("bugReport.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bug-description">{t("bugReport.whatHappened")}</Label>
            <textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={t("bugReport.placeholder")}
              className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bug-contact">{t("bugReport.contact")}</Label>
            <Input
              id="bug-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={200}
              placeholder={t("bugReport.contactPlaceholder")}
            />
          </div>

          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <div className="flex items-center gap-2">
            <input
              id="bug-attach-state"
              type="checkbox"
              checked={attachState}
              onChange={(e) => setAttachState(e.target.checked)}
              className="size-4 accent-primary"
            />
            <Label htmlFor="bug-attach-state" className="font-normal">
              {t("bugReport.attachState")}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("bugReport.cancel")}
          </Button>
          <Button onClick={submit} disabled={sending || !description.trim()}>
            {sending ? t("bugReport.sending") : t("bugReport.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
