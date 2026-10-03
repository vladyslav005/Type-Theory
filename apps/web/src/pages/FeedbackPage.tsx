import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ClipboardList, ExternalLink, Lightbulb, MessageSquareHeart} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/shared/components/ui/button.tsx";
import {Input} from "@/shared/components/ui/input.tsx";
import {Label} from "@/shared/components/ui/label.tsx";
import {usePageMeta} from "@/shared/hooks/usePageMeta.ts";
import {useTurnstile} from "@/shared/hooks/useTurnstile.ts";
import {QUESTIONNAIRES, type Questionnaire} from "@/shared/feedback/questionnaires.ts";

const localized = (text: Questionnaire["title"], language: string) =>
  text[language as keyof typeof text] ?? text.en;

function SuggestionForm() {
  const {t, i18n} = useTranslation();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const {enabled: turnstileEnabled, token: turnstileToken, containerRef: turnstileRef, reset: resetTurnstile, ready: turnstileReady} = useTurnstile(true);

  const submit = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          message,
          contact,
          website,
          page: location.href,
          language: i18n.resolvedLanguage,
          turnstileToken,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(t("feedbackPage.suggestion.sent"));
      setMessage("");
    } catch {
      toast.error(t("feedbackPage.suggestion.failed"));
    } finally {
      resetTurnstile();
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4">
      <div className="space-y-1.5">
        <Label htmlFor="suggestion-message">{t("feedbackPage.suggestion.message")}</Label>
        <textarea
          id="suggestion-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder={t("feedbackPage.suggestion.placeholder")}
          className="border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="suggestion-contact">{t("feedbackPage.suggestion.contact")}</Label>
        <Input
          id="suggestion-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={200}
          placeholder={t("feedbackPage.suggestion.contactPlaceholder")}
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

      {turnstileEnabled && <div ref={turnstileRef} className="flex justify-center"/>}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={sending || !message.trim() || !turnstileReady}>
          {sending ? t("feedbackPage.suggestion.sending") : t("feedbackPage.suggestion.send")}
        </Button>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const {t, i18n} = useTranslation();
  usePageMeta(t("feedbackPage.metaTitle"), undefined, undefined, {noindex: true});

  return (
    <div className="pt-16 min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <MessageSquareHeart className="h-7 w-7 text-primary"/>
            {t("feedbackPage.title")}
          </h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">{t("feedbackPage.intro")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ClipboardList className="h-5 w-5 text-primary"/>
            {t("feedbackPage.questionnaires.title")}
          </h2>
          {QUESTIONNAIRES.length > 0 ? (
            <ul className="space-y-2">
              {QUESTIONNAIRES.map((q) => (
                <li key={q.url}>
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{localized(q.title, i18n.language)}</span>
                      {q.description && <span className="block text-sm text-muted-foreground">{localized(q.description, i18n.language)}</span>}
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground"/>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("feedbackPage.questionnaires.empty")}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Lightbulb className="h-5 w-5 text-primary"/>
            {t("feedbackPage.suggestion.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("feedbackPage.suggestion.description")}</p>
          <SuggestionForm/>
        </section>
      </div>
    </div>
  );
}
