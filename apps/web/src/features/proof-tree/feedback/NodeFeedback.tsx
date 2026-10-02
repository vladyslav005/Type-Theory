import {Fragment} from "react";
import {useTranslation} from "react-i18next";
import {AlertCircle} from "lucide-react";
import type {FeedbackMessage} from "./feedback.ts";

// ⟦…⟧ in a message marks the wrong part of the student's own type.
function withMarks(text: string) {
  return text.split(/(⟦[^⟧]*⟧)/).map((part, i) =>
    part.startsWith("⟦")
      ? <mark key={i} className="rounded bg-destructive/15 px-0.5 font-mono text-destructive">{part.slice(1, -1)}</mark>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

export function NodeFeedback({messages}: {messages: FeedbackMessage[]}) {
  const {t} = useTranslation();
  if (messages.length === 0) return null;
  const translate = (message: FeedbackMessage) => {
    const params = Object.fromEntries(Object.entries(message.params ?? {}).map(([key, value]) =>
      [key, typeof value === "string" && value.startsWith("@") ? t(value.slice(1)) : value]));
    return t(message.code, params);
  };
  return (
    <ul className="mx-auto max-w-md space-y-0.5 px-2 pb-1 text-[11px] leading-snug text-destructive">
      {messages.map((message, i) => (
        <li key={i} className="flex items-start gap-1">
          <AlertCircle className="mt-px h-3 w-3 shrink-0"/>
          <span>{withMarks(translate(message))}</span>
        </li>
      ))}
    </ul>
  );
}
