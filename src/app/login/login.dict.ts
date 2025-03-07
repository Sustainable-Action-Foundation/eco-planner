import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "page": {
    "breadcrumbLogin": {
      "en": "Login",
      "sv": "Logga in",
    }[locale],
    "photoBy": {
      "en": "Photo by",
      "sv": "Foto av",
    }[locale],
    "on": {
      "en": "on",
      "sv": "på",
    }[locale],
  },
});