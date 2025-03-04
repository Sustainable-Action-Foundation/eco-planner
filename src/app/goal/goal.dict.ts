import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "[goalId]": {
    "page": {
      "compareGoal": {
        "en": "Compare with goal",
        "sv": "Jämför med målbanan"
      }[locale],
      "goal": {
        "en": "Goal",
        "sv": "Målbana"
      }[locale],
      "goalScale": {
        "en": "All values in the goal use the following scale:",
        "sv": "Alla värden i målbanan använder följande skala:"
      }[locale],
      "infoPrompt": {
        "en": "Please bake the scale into the value or unit; scales will be removed in the future.",
        "sv": "Vänligen baka in skalan i värdet eller enheten; skalor kommer att tas bort i framtiden."
      }[locale],
      "externalResources": {
        "en": "External resources",
        "sv": "Externa resurser"
      }[locale],
      "alignedGoals": {
        "en": "Goals that work towards this",
        "sv": "Mål som jobbar mot detta"
      }[locale],
      "similarGoals": {
        "en": "Similar goals in this roadmap version",
        "sv": "Liknande målbanor i denna färdplansversion"
      }[locale],
      "actions": {
        "en": "Actions",
        "sv": "Åtgärder"
      }[locale],
      "connectToAction": {
        "en": "Connect to an existing action",
        "sv": "Koppla till en existerande åtgärd"
      }[locale],
      "createNewAction": {
        "en": "Create a new action",
        "sv": "Skapa ny åtgärd"
      }[locale]
    },
    "edit": {
      "page": {
        "breadcrumbEditGoal": {
          "en": "Edit goal",
          "sv": "Redigera målbana"
        }[locale],
        "editGoal": {
          "en": "Edit Goal:",
          "sv": "Redigera målbana:"
        }[locale]
      }
    }
  },
  "create": {
    "page": {
      "breadcrumbCreateGoal": {
        "en": "Create new goal",
        "sv": "Skapa ny målbana"
      }[locale],
      "createNewGoal": {
        "en": "Create a new goal",
        "sv": "Skapa en ny målbana"
      }[locale],
      "badRoadmap": {
        "en": "Could not find or do not have access to the roadmap version in the link.\nUse the dropdown menu to select a roadmap version to create the goal path under.",
        "sv": "Kunde inte hitta eller har inte tillgång till färdplansversionen i länken.\nAnvänd dropdown-menyn för att välja en färdplansversion att skapa målbanan under."
      }[locale]
    }
  }
});