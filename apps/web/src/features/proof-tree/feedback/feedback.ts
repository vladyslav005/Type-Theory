// `code` is a full i18n key; a param value starting with "@" is itself an i18n key, translated before interpolation.
export interface FeedbackMessage {
  code: string;
  params?: Record<string, string | number>;
}

export const translatedParam = (key: string) => `@${key}`;
