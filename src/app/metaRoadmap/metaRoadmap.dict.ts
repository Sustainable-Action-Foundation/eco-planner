import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "[metaRoadmapId]": {
    "page": {
      "roadmap": {
        "en": "Roadmap",
        "sv": "Färdplansserie",
      }[locale],
      "metadataLabel": {
        "en": "Metadata for a series of roadmap versions",
        "sv": "Metadata för en serie av färdplansversioner",
      }[locale],
      "externalResources": {
        "en": "External resources",
        "sv": "Externa resurser",
      }[locale],
      "roadmaps": {
        "en": "Roadmaps",
        "sv": "Färdplaner",
      }[locale],
      "newRoadmapVersion": {
        "en": "Create new roadmap version",
        "sv": "Skapa ny färdplansversion",
      }[locale],
    },
    "edit": {
      "page": {
        "breadcrumbEditMetadata": {
          "en": "Edit metadata",
          "sv": "Redigera metadata",
        }[locale],
        "editMetadata": {
          "en": "Edit metadata for roadmap:",
          "sv": "Redigera metadatan för färdplansserie:",
        }[locale],
      },
    },
  },
  "create": {
    "page": {
      "breadcrumbCreateRoadmap": {
        "en": "Create roadmap",
        "sv": "Skapa färdplansserie",
      }[locale],
      "newRoadmap": {
        "en": "Create a new roadmap",
        "sv": "Skapa en ny färdplansserie",
      }[locale],
    },
  },
});