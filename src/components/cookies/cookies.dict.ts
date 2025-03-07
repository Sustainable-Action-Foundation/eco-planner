import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "languageSwitcher": {
    "languages": {
      "swedish": {
        "en": "Swedish",
        "sv": "Svenska",
      }[locale],
      "english": {
        "en": "English",
        "sv": "Engelska",
      }[locale],
    },
  },
  "graphCookie": {
    "allowStorage": {
      "en": "Allow storage of future view changes between sessions and page navigations.",
      "sv": "Spara framtida vyändringar mellan sessioner och sidonavigeringar.",
    }[locale],
  },
});