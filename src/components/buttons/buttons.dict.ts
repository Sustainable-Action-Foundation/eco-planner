import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "updateGoalButton": {
    "updateGoal": {
      "en": "Update goal",
      "sv": "Uppdatera målbana"
    }[locale]
  },
  "metaRoadmapDeleter": {
    "removeMetadata": {
      "en": "Remove metadata",
      "sv": "Ta bort metadata"
    }[locale]
  },
  "logoutButton": {
    "logoutFailed": {
      "en": "Logout failed",
      "sv": "Utloggning misslyckades"
    }[locale],
    "logout": {
      "en": "Logout",
      "sv": "Logga ut"
    }[locale]
  }
});