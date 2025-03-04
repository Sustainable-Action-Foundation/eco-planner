import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "page": {
    "roadmaps": {
      "en": "Roadmaps",
      "sv": "Färdplaner"
    }[locale],
    "photoBy": {
      "en": "Photo by",
      "sv": "Foto av"
    }[locale],
    "on": {
      "en": "on",
      "sv": "på"
    }[locale],
    "createRoadmap": {
      "en": "Create new roadmap",
      "sv": "Skapa ny färdplansserie"
    }[locale]
  },
  "layout": {
    "head": {
      "description": {
        "en": "A tool intended to contribute to the climate transition of Sweden.\nIn the tool, national scenarios, also known as quantitative roadmaps, can be broken down to a regional and municipal level and an action plan can be created.\nThe action plan is built on actions related to a specific goal and together the goals together constitute the roadmap.\nUsers can be inspired by each others' actions. In that way, a common action database is created for Sweden. On a municipal level, different actors can also work together around actions.",
        "sv": "Ett verktyg som syftar till att bidra till Sveriges klimatomställning.\nI verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas.\nHandlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen.\nAnvändare kan inspireras av varandras åtgärder. På så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder."
      }[locale],
      "og": {
        "description": {
          "en": "A tool intended to contribute to the climate transition of Sweden.\nIn the tool, national scenarios, also known as quantitative roadmaps, can be broken down to a regional and municipal level and an action plan can be created.\nThe action plan is built on actions related to a specific goal and together the goals together constitute the roadmap.\nUsers can be inspired by each others' actions. In that way, a common action database is created for Sweden. On a municipal level, different actors can also work together around actions.",
          "sv": "Ett verktyg som syftar till att bidra till Sveriges klimatomställning.\nI verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas.\nHandlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen.\nAnvändare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder."
        }[locale],
        "locale": {
          "en": "en_US",
          "sv": "sv_SE"
        }[locale]
      }
    }
  }
});