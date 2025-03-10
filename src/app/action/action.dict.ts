import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "[actionId]": {
    "page": {
      "summary": {
        "action": {
          "en": "Action",
          "sv": "Åtgärd",
        }[locale],
        "externalResources": {
          "en": "External resources",
          "sv": "Externa resurser",
        }[locale],
        "editAction": {
          "en": "Edit action",
          "sv": "Redigera åtgärd",
        }[locale],
      },
      "expectedEffects": {
        "expectedEffect": {
          "en": "Expected effect",
          "sv": "Förväntad effekt",
        }[locale],
        "noSpecifiedEffect": {
          "en": "No specified effect",
          "sv": "Ingen angiven effekt",
        }[locale],
      },
      "costEfficiency": {
        "costEfficiency": {
          "en": "Cost efficiency",
          "sv": "Kostnadseffektivitet",
        }[locale],
        "noSpecifiedCostEfficiency": {
          "en": "No specified cost efficiency",
          "sv": "Ingen angiven kostnadseffektivitet",
        }[locale],
      },
      "projectLeader": {
        "projectLeader": {
          "en": "Project leader",
          "sv": "Projektledare",
        }[locale],
        "noSpecifiedProjectLeader": {
          "en": "No specified project leader",
          "sv": "Ingen angiven projektledare",
        }[locale],
      },
      "relevantActors": {
        "relevantActors": {
          "en": "Relevant actors",
          "sv": "Relevanta aktörer",
        }[locale],
        "noSpecifiedRelevantActors": {
          "en": "No specified actors",
          "sv": "Inga angivna aktörer",
        }[locale],
      },
      "categories": {
        "categories": {
          "en": "Categories",
          "sv": "Kategorier",
        }[locale],
        "categoryTypes": {
          "efficiency": {
            "en": "Efficiency",
            "sv": "Effektivitet",
          }[locale],
          "sufficiency": {
            "en": "Sufficiency",
            "sv": "Tillräcklighet",
          }[locale],
          "renewables": {
            "en": "Renewables",
            "sv": "Förnybarhet",
          }[locale],
        },
        "noSpecifiedCategories": {
          "en": "No specified categories",
          "sv": "Inga angivna kategorier",
        }[locale],
      },
      "effects": {
        "effects": {
          "en": "Effects",
          "sv": "Effekter",
        }[locale],
        "createEffect": {
          "en": "Create new effect",
          "sv": "Skapa ny effekt",
        }[locale],
      },
    },
    "edit": {
      "page": {
        "breadcrumbEditAction": {
          "en": "Edit action",
          "sv": "Redigera åtgärd",
        }[locale],
        "editAction": {
          "en": (actionName: string, roadmapName: string, roadmapVersion: string) => `Edit action: ${actionName} of roadmap ${roadmapName} v${roadmapVersion}`,
          "sv": (actionName: string, roadmapName: string, roadmapVersion: string) => `Redigera åtgärd: ${actionName} av färdplan ${roadmapName} v${roadmapVersion}`,
        }[locale],
      },
    },
  },
  "create": {
    "page": {
      "breadcrumbCreateAction": {
        "en": "Create new action",
        "sv": "Skapa ny åtgärd",
      }[locale],
      "goal": {
        "createActionUnderGoal": {
          "en": "Create new action under goal:",
          "sv": "Skapa ny åtgärd under målbana:",
        }[locale],
        "createAction": {
          "en": "Create new action",
          "sv": "Skapa ny åtgärd",
        }[locale],
      },
      "badGoal": {
        "notFound": {
          "en": "Could not find or do not have access to the goal in the link.",
          "sv": "Kunde inte hitta eller har inte tillgång till målbanan i länken.",
        }[locale],
      },
      "badRoadmap": {
        "notFound": {
          "en": "Could not find or do not have access to the roadmap in the link.\nUse the dropdown menu to select a roadmap.",
          "sv": "Kunde inte hitta eller har inte tillgång till färdplansversionen i länken.\nAnvänd dropdown-menyn för att välja en färdplansversion.",
        }[locale],
      },
    },
  },
});