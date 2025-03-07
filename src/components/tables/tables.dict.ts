import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "goals": {
    "searchGoals": {
      "en": "Search goals",
      "sv": "Sök bland målbanor",
    }[locale],
    "sortBy": {
      "en": "Sort by",
      "sv": "Sortera efter",
    }[locale],
    "sortingOptions": {
      "default": {
        "en": "Default",
        "sv": "Standard",
      }[locale],
      "alpha": {
        "en": "Name (A-Z)",
        "sv": "Namn (A-Ö)",
      }[locale],
      "alphaReverse": {
        "en": "Name (Z-A)",
        "sv": "Namn (Ö-A)",
      }[locale],
      "actionsFalling": {
        "en": "Amount of actions (falling)",
        "sv": "Antal åtgärder (fallande)",
      }[locale],
      "actionsRising": {
        "en": "Amount of actions (rising)",
        "sv": "Antal åtgärder (stigande)",
      }[locale],
      "interesting": {
        "en": "Interesting",
        "sv": "Intresse",
      }[locale],
    },
    "createGoal": {
      "en": "Create new goal",
      "sv": "Skapa ny målbana",
    }[locale],
    "settingsAltText": {
      "en": "Settings",
      "sv": "Inställningar",
    }[locale],
    "loading": {
      "en": "Loading",
      "sv": "Laddar",
    }[locale],
  },
  "effects": {
    "noEffectsReturn": {
      "noEffects": {
        "en": "There are no effects to show.",
        "sv": "Det finns inga effekter att visa.",
      }[locale],
      "doYouWantTo": {
        "en": "Do you want to create one?",
        "sv": "Vill du skapa en?",
      }[locale],
      "createEffect": {
        "en": "Create new effect",
        "sv": "Skapa ny effekt",
      }[locale],
    },
    "hasEffectsReturn": {
      "namelessEffect": {
        "en": "Nameless effect",
        "sv": "Namnlös effekt",
      }[locale],
    },
  },
  "actions": {
    "noActions": {
      "en": "There are no actions to show.",
      "sv": "Det finns inga åtgärder att visa.",
    }[locale],
    "createActionQuestion": {
      "en": "Do you want to create one?",
      "sv": "Vill du skapa en?",
    }[locale],
    "createNewAction": {
      "en": "Create new action",
      "sv": "Skapa ny åtgärd",
    }[locale],
  },
  "tableSelector": {
    "tableSelector": {
      "treeDisplay": {
        "en": "Tree",
        "sv": "Träd",
      }[locale],
      "tableDisplay": {
        "en": "Table",
        "sv": "Tabell",
      }[locale],
      "actionsDisplay": {
        "en": "Actions",
        "sv": "Åtgärder",
      }[locale],
    },
  },
  "tableMenu": {
    "tableMenu": {
      "metaRoadmaps": {
        "creationDescription": {
          "en": "New roadmap version",
          "sv": "Ny färdplansversion",
        }[locale],
      },
      "roadmaps": {
        "parentDescription": {
          "en": "Go to roadmap",
          "sv": "Gå till färdplansserien",
        }[locale],
        "creationDescription": {
          "en": "New goal",
          "sv": "Ny målbana",
        }[locale],
        "creationDescription2": {
          "en": "New action",
          "sv": "Ny åtgärd",
        }[locale],
      },
      "goals": {
        "parentDescription": {
          "en": "Go to roadmap version",
          "sv": "Gå till färdplansversionen",
        }[locale],
        "creationDescription": {
          "en": "New action",
          "sv": "Ny åtgärd",
        }[locale],
        "creationDescription2": {
          "en": "Add effect from existing action",
          "sv": "Lägg till effekt från befintlig åtgärd",
        }[locale],
      },
      "actions": {
        "parentDescription": {
          "en": "Go to roadmap version",
          "sv": "Gå till färdplansversionen",
        }[locale],
        "creationDescription": {
          "en": "New effect",
          "sv": "Ny effekt",
        }[locale],
      },
      "effects": {
        "parentDescription": {
          "en": "Go to goal",
          "sv": "Gå till målbanan",
        }[locale],
        "effectFrom": {
          "en": "Effect from",
          "sv": "Effekt från",
        }[locale],
        "nameMissing": {
          "en": "Name missing",
          "sv": "Namn saknas",
        }[locale],
      },
      "return": {
        "nameMissing": {
          "en": "Name missing",
          "sv": "Namn saknas",
        }[locale],
        "menuFor": {
          "en": "menu for",
          "sv": "meny för",
        }[locale],
        "menu": {
          "en": "menu",
          "sv": "meny",
        }[locale],
        "close": {
          "en": "close",
          "sv": "stäng",
        }[locale],
        "edit": {
          "en": "Edit",
          "sv": "Redigera",
        }[locale],
        "deletePost": {
          "en": "Delete post",
          "sv": "Radera inlägg",
        }[locale],
      },
    },
  },
  "roadmapTables": {
    "roadmapTree": {
      "noRoadmaps": {
        "en": "No roadmaps found. If you have any filters active, no roadmaps matching them were found.",
        "sv": "Inga färdplaner hittades. Om du har några filter aktiva så hittades inga färdplaner som matchar dem.",
      }[locale],
      "nestedRoadmapRenderer": {
        "showUnderlyingRoadmaps": {
          "en": "Show underlying roadmaps",
          "sv": "Visa underliggande färdplaner",
        }[locale],
        "goals": {
          "en": "Goals",
          "sv": "Målbanor",
        }[locale],
      },
    },
    "roadmapTable": {
      "goals": {
        "en": "Goals",
        "sv": "Målbanor",
      }[locale],
      "noRoadmapVersions": {
        "en": "No roadmap versions found. If you have any filters active, no roadmap versions matching them were found.",
        "sv": "Inga färdplansversioner hittades. Om du har några filter aktiva så hittades inga färdplansversioner som matchar dem.",
      }[locale],
    },
  },
  "goalTables": {
    "linkTree": {
      "noGoal": {
        "en": "You do not have access to any goals in this roadmap version, or the roadmap version is empty.",
        "sv": "Du har inte tillgång till några målbanor i denna färdplansversion, eller så är färdplansversionen tom.",
      }[locale],
    },
    "goalTable": {
      "noGoals": {
        "en": "You do not have access to any goals in this roadmap version, or the roadmap version is empty.",
        "sv": "Du har inte tillgång till några målbanor i denna färdplansversion, eller så är färdplansversionen tom.",
      }[locale],
      "tableHeader": {
        "goalName": {
          "en": "Goal name",
          "sv": "Målbanenamn",
        }[locale],
        "LEAPParameter": {
          "en": "LEAP parameter",
          "sv": "LEAP-parameter",
        }[locale],
        "seriesUnit": {
          "en": "Unit",
          "sv": "Enhet",
        }[locale],
        "actionCount": {
          "en": "Action count",
          "sv": "Antal åtgärder",
        }[locale],
      },
    },
  },
});