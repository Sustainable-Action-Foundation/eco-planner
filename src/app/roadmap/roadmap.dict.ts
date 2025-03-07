import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "[roadmapId]": {
    "page": {
      "roadmap": {
        "en": "Roadmap",
        "sv": "Färdplan",
      }[locale],
      "version": {
        "en": "Version",
        "sv": "Version",
      }[locale],
      "goals": {
        "en": "goals",
        "sv": "målbanor",
      }[locale],
      "visitRoadmap": {
        "en": "Visit roadmap",
        "sv": "Besök färdplansserien",
      }[locale],
      "editRoadmapVersion": {
        "en": "Edit roadmap version",
        "sv": "Redigera färdplansversionen",
      }[locale],
      "selectGoals": {
        "en": "Select goals",
        "sv": "Utvalda målbanor",
      }[locale],
      "allGoals": {
        "en": "All goals",
        "sv": "Alla målbanor",
      }[locale],
    },
    "edit": {
      "page": {
        "breadcrumbEditRoadmapVersion": {
          "en": "Edit roadmap version",
          "sv": "Redigera färdplansversion",
        }[locale],
        "edit": {
          "editRoadmapVersion": {
            "en": "Edit roadmap version",
            "sv": "Redigera färdplansversionen",
          }[locale],
          "didYouMeanTo": {
            "en": "Did you mean to edit the common metadata for the entire roadmap? If so, you can ",
            "sv": "Ville du redigera den gemensamma metadatan för hela färdplansserien? Isåfall kan du ",
          }[locale],
          "goHere": {
            "en": "go here",
            "sv": "gå hit",
          }[locale],
          "toEdit": {
            "en": " to edit the metadata.",
            "sv": " för att redigera metadatan.",
          }[locale],
        },
        "editRoadmapVersion": {
          "en": "Edit roadmap version",
          "sv": "Redigera färdplansversionen",
        }[locale],
        "didYouMeanTo": {
          "en": "Did you mean to edit the common metadata for the entire roadmap? If so, you can ",
          "sv": "Ville du redigera den gemensamma metadatan för hela färdplansserien? Isåfall kan du ",
        }[locale],
        "goHere": {
          "en": "go here",
          "sv": "gå hit",
        }[locale],
        "toEdit": {
          "en": " to edit the metadata.",
          "sv": " för att redigera metadatan.",
        }[locale],
      },
    },
  },
  "create": {
    "page": {
      "breadcrumbCreateRoadmapVersion": {
        "en": "Create new roadmap version",
        "sv": "Skapa ny färdplansversion",
      }[locale],
      "newRoadmapVersion": {
        "en": "Create a new version in a roadmap series",
        "sv": "Skapa en ny version i en färdplansserie",
      }[locale],
      "badMetaRoadmap": {
        "en": "Could not find or do not have access to the roadmap in the link.\nUse the dropdown menu to select a roadmap series.",
        "sv": "Kunde inte hitta eller har inte tillgång till färdplansserien i länken.\nAnvänd dropdown-menyn för att välja en färdplansserie.",
      }[locale],
    },
  },
});