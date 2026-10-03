export interface Questionnaire {
  url: string;
  title: Partial<Record<"en" | "sk" | "uk", string>> & {en: string};
  description?: Partial<Record<"en" | "sk" | "uk", string>> & {en: string};
}

export const QUESTIONNAIRES: Questionnaire[] = [];
