import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "page": {
    "breadcrumbCreateAccount": {
      "en": "Create account",
      "sv": "Skapa konto"
    }[locale],
    "photoBy": {
      "en": "Photo by",
      "sv": "Foto av"
    }[locale],
    "on": {
      "en": "on",
      "sv": "på"
    }[locale]
  }
});