import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "breadcrumbSections": {
    "baseSection": {
      "home": {
        "en": "Home",
        "sv": "Hem",
      }[locale],
    },
    "metaRoadmapSection": {
      "roadmap": {
        "en": "Roadmap:",
        "sv": "Färdplansserie:",
      }[locale],
    },
    "roadmapSection": {
      "version": {
        "en": "Version:",
        "sv": "Version:",
      }[locale],
      "versionLink": {
        "en": "Version",
        "sv": "Version",
      }[locale],
    },
    "goalSection": {
      "goal": {
        "en": "Goal:",
        "sv": "Målbana:",
      }[locale],
    },
    "actionSection": {
      "action": {
        "en": "Action:",
        "sv": "Åtgärd:",
      }[locale],
    },
  },
});