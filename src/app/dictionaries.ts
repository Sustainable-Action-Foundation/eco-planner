import { Locale } from "@/types";
import "server-only";

// Object with json files for all supported languages
const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  sv: () => import("@/dictionaries/sv.json").then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => dictionaries[locale]();