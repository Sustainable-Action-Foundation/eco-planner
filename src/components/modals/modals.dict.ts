import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "copyAndScale": {
    "getScalingResult": {
      "whyIsThisAFile": {
        "en": "Why is this a file?",
        "sv": "Varför är detta en fil?",
      }[locale],
    },
    "formSubmission": {
      "whyIsThisAFile": {
        "en": "Why is this a file?",
        "sv": "Varför är detta en fil?",
      }[locale],
      "invalidInput": {
        "en": "Invalid input. Scaling factor could not be calculated. This is often due to a non-numeric value in an input field or the product of all scaling factors being negative.",
        "sv": "Felaktig inmatning. Skalningsfaktorn kunde inte beräknas. Ofta beror detta på ett ickenumeriskt värde i ett inmatningsfält eller att produkten av alla skalningsfaktorer är negativ.",
      }[locale],
    },
    "return": {
      "title": {
        "en": "Copy and scale",
        "sv": "Kopiera och skala",
      }[locale],
      "copyAndScaleGoal": {
        "en": "Copy and scale the goal",
        "sv": "Kopiera och skala målbanan",
      }[locale],
      "whichRoadmapVersion": {
        "en": "Which roadmap version do you want to place the scaled goal in?",
        "sv": "I vilken färdplansversion vill du placera den skalade målbanan?",
      }[locale],
      "selectRoadmapVersion": {
        "en": "Select roadmap version",
        "sv": "Välj färdplansversion",
      }[locale],
      "version": {
        "en": "version",
        "sv": "version",
      }[locale],
      "scalingComponents": {
        "removeScaling": {
          "en": "Remove scaling",
          "sv": "Ta bort skalning",
        }[locale],
      },
      "addScaling": {
        "title": {
          "en": "Add scaling",
          "sv": "Lägg till skalning",
        }[locale],
        "advanced": {
          "title": {
            "en": "Advanced",
            "sv": "Avancerat",
          }[locale],
          "selectScalingMethod": {
            "en": "Select scaling method",
            "sv": "Välj skalningsmetod",
          }[locale],
          "geometric": {
            "en": "Geometric average",
            "sv": "Geometriskt genomsnitt",
          }[locale],
          "algebraic": {
            "en": "Algebraic average",
            "sv": "Algebraiskt genomsnitt",
          }[locale],
          "multiplicative": {
            "en": "Multiplicative scaling",
            "sv": "Multiplikativ skalning",
          }[locale],
        },
      },
      "resultingScalingFactor": {
        "en": "Resulting scaling factor",
        "sv": "Resulterande skalningsfaktor",
      }[locale],
      "createScaledCopy": {
        "en": "Create scaled copy",
        "sv": "Skapa skalad kopia",
      }[locale],
    },
  },
  "confirmDelete": {
    "deletionFailed": {
      "en": "Deletion failed: No target ID provided. This shouldn't happen so please report this to the developers.",
      "sv": "Radering misslyckades: Inget mål-ID angivet. Detta borde inte hända så vänligen rapportera detta till utvecklarna.",
    }[locale],
    "deletePost": {
      "en": "Delete post",
      "sv": "Radera inlägg",
    }[locale],
    "areYouSure": {
      "en": "Are you sure you want to delete the post",
      "sv": "Är du säker på att du vill radera inlägget",
    }[locale],
    "youCannotUndo": {
      "en": "You cannot undo this action later.",
      "sv": "Du kan inte ångra denna åtgärd senare.",
    }[locale],
    "type": {
      "en": "Type",
      "sv": "Skriv",
    }[locale],
    "toConfirm": {
      "en": "to confirm",
      "sv": "för att bekräfta",
    }[locale],
    "cancel": {
      "en": "Cancel",
      "sv": "Avbryt",
    }[locale],
    "delete": {
      "en": "Delete",
      "sv": "Radera",
    }[locale],
  },
});