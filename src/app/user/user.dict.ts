import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "[user]": {
    "page": {
      "manageMyData": {
        "en": "Manage my data",
        "sv": "Hantera mina data",
      }[locale],
      "myPosts": {
        "en": "My posts",
        "sv": "Mina inlägg",
      }[locale],
      "usersPosts": {
        "en": "'s posts",
        "sv": "s inlägg",
      }[locale],
      "roadmapSeries": {
        "en": "Roadmap series",
        "sv": "Färdplansserier",
      }[locale],
      "amountOfRoadmaps": {
        "en": "Amount of roadmaps:",
        "sv": "Antal färdplaner:",
      }[locale],
      "roadmaps": {
        "en": "Roadmaps",
        "sv": "Färdplaner",
      }[locale],
      "amountOfGoals": {
        "en": "Amount of goals:",
        "sv": "Antal målbanor:",
      }[locale],
    },
  },
});