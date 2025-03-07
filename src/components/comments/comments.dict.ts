import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "comments": {
    "comments": {
      "en": "Comments",
      "sv": "Kommentarer",
    }[locale],
    "submitComment": {
      "writeComment": {
        "en": "Write comment",
        "sv": "Skriv kommentar",
      }[locale],
      "cancel": {
        "en": "Cancel",
        "sv": "Avbryt",
      }[locale],
      "submit": {
        "en": "Submit",
        "sv": "Skicka",
      }[locale],
    },
    "commentInfo": {
      "ago": {
        "en": "ago",
        "sv": "sedan",
      }[locale],
      "showLess": {
        "en": "Show less",
        "sv": "Visa mindre",
      }[locale],
      "showMore": {
        "en": "Show more",
        "sv": "Visa mer",
      }[locale],
    },
  },
});