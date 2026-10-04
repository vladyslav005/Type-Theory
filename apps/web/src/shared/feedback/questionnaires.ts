type Localized = Partial<Record<"en" | "sk" | "uk", string>> & {en: string};

export interface Questionnaire {
  url: string;
  title: Localized;
  description?: Localized;
  minutes?: number;
  anonymous?: boolean;
}

export const QUESTIONNAIRES: Questionnaire[] = [
  {
    url: "https://docs.google.com/forms/d/e/1FAIpQLScuAVd7xJGmX4w51Q7rc_-MbhBH8b4EecHXeYGlwGntPExhRA/viewform",
    title: {
      en: "Questionnaire 1/4 – weeks 1–3",
      sk: "Dotazník 1/4 – týždne 1–3",
      uk: "Опитування 1/4 – тижні 1–3",
    },
    description: {
      en: "This questionnaire is for Type Theory students. Before you fill it in, try out the labs, the lectures and the editor.",
      sk: "Dotazník je pre študentov Teórie typov. Skôr než ho vyplníte, vyskúšajte si cvičenia, prednášky aj editor.",
      uk: "Опитування для студентів курсу «Теорія типів». Перш ніж його заповнити, спробуйте лабораторні, лекції та редактор.",
    },
    minutes: 6,
    anonymous: true,
  },
];
