import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "edit": {
    "page": {
      "breadcrumbEditEffect": {
        "en": "Edit effect",
        "sv": "Redigera effekt",
      }[locale],
      "editEffect": {
        "en": "Edit Effect",
        "sv": "Redigera effekt",
      }[locale],
      "badEffect": {
        "en": "The effect you are trying to edit does not exist or you do not have editing rights to it.",
        "sv": "Effekten du försöker redigera finns inte eller så har du inte redigeringsbehörighet till den.",
      }[locale],
    },
  },
  "create": {
    "page": {
      "breadcrumbCreateEffect": {
        "en": "Create new effect",
        "sv": "Skapa ny effekt",
      }[locale],
      "createNewEffect": {
        "en": "Create new effect",
        "sv": "Skapa ny effekt",
      }[locale],
      "badAction": {
        "en": "The action you specified in the URL could not be found or you do not have editing rights to it. Please select a new one in the form below.",
        "sv": "Åtgärden du angav i URL:en kunde inte hittas eller så har du inte redigeringsbehörighet till den. Vänligen välj en ny i formuläret nedan.",
      }[locale],
      "badGoal": {
        "en": "The goal you specified in the URL could not be found or you do not have editing rights to it. Please select a new one in the form below.",
        "sv": "Målbanan du angav i URL:en kunde inte hittas eller så har du inte redigeringsbehörighet till den. Vänligen välj en ny i formuläret nedan.",
      }[locale],
    },
  },
});