import "server-only";

export const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  sv: () => import("@/dictionaries/sv.json").then((module) => module.default),
};

export const getDictionary = async (locale: keyof typeof dictionaries) => dictionaries[locale]();
