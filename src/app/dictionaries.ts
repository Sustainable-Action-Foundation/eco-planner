import { Locale } from "@/types";
import "server-only";

// Object with json files for all supported languages
const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  sv: () => import("@/dictionaries/sv.json").then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => dictionaries[locale]();

const Bdictionaries = {
  "@/app/layout": () => import("@/app/layout.dict.json").then((module) => module.default),
  "@/app/page": () => import("@/app/page.dict.json").then((module) => module.default),
  "@/app/roadmap/[roadmapId]/page": () => import("@/app/roadmap/[roadmapId]/page.dict.json").then((module) => module.default),
  // "@/components/buttons/logoutButton": () => import("@/components/buttons/logoutButton.dict.json").then((module) => module.default),
  // "@/components/cookies/languageSwitcher": () => import("@/components/cookies/languageSwitcher.dict.json").then((module) => module.default),
  // "@/components/forms/filters/roadmapFilters": () => import("@/components/forms/filters/roadmapFilters.dict.json").then((module) => module.default),
  // "@/components/geneneric/header/sidebar": () => import("@/components/generic/header/sidebar.dict.json").then((module) => module.default),
  // "@/components/tables/roadmapTables/roadmapTree": () => import("@/components/tables/roadmapTables/roadmapTree.dict.json").then((module) => module.default),
};

type BdictionariesKeys = keyof typeof Bdictionaries;

export const BgetDictionary = async (path: BdictionariesKeys) => Bdictionaries[path]();

// TODO - maybe pass path instead of locale to getDictionary.
// This way, smaller dictionaries can be loaded for different pages