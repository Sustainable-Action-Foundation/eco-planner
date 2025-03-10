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
        "en": (username: string) => `${username}'s posts`,
        "sv": (username: string) => `${username}s inlägg`,
      }[locale],
      "roadmapSeries": {
        "en": "Roadmap series",
        "sv": "Färdplansserier",
      }[locale],
      "roadmapCount": {
        "en": (roadmapCount: string) => `Contains ${roadmapCount} versions`,
        "sv": (roadmapCount: string) => `Innehåller ${roadmapCount} versioner`,
      }[locale],
      "versions": {
        "en": "Versions",
        "sv": "Versioner",
      }[locale],
      "goalCount": {
        "en": (goalCount: string) => `Contains ${goalCount} goals`,
        "sv": (goalCount: string) => `Innehåller ${goalCount} målbanor`,
      }[locale],
    },
  },
});