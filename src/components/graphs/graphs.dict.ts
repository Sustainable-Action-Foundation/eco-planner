import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "siblingGraph": {
    "menu": {
      "changeGraphType": {
        "en": "Change graph type",
        "sv": "Byt graftyp"
      }[locale],
      "changeGraphAlt": {
        "en": "Change graph",
        "sv": "Byt graf"
      }[locale]
    }
  },
  "actionGraph": {
    "actionGraph": {
      "actions": {
        "en": "Actions",
        "sv": "Åtgärder"
      }[locale]
    }
  },
  "mainGraphs": {
    "mainRelativeGraph": {
      "nationalGoal": {
        "name": {
          "en": "National equivalent",
          "sv": "Nationell motsvarighet"
        }[locale]
      },
      "chartOptions": {
        "yAxis": {
          "title": {
            "en": "Percentage relative base year",
            "sv": "procent relativt basår"
          }[locale]
        }
      }
    },
    "mainGraph": {
      "mainChartOptions": {
        "baseScenario": {
          "en": "Base scenario",
          "sv": "Basfall"
        }[locale],
        "expectedOutcome": {
          "en": "Expected outcome",
          "sv": "Förväntat utfall"
        }[locale]
      },
      "ifBaselineDataSeries": {
        "baseScenario": {
          "en": "Base scenario",
          "sv": "Basfall"
        }[locale],
        "expectedOutcome": {
          "en": "Expected outcome",
          "sv": "Förväntat utfall"
        }[locale]
      },
      "ifNoBaselineIsSet": {
        "baseScenario": {
          "en": "Base scenario",
          "sv": "Basfall"
        }[locale],
        "expectedOutcome": {
          "en": "Expected outcome",
          "sv": "Förväntat utfall"
        }[locale]
      },
      "secondaryGoal": {
        "en": "Secondary goal",
        "sv": "Sekundär målbana"
      }[locale],
      "nationalGoal": {
        "nationalEquivalent": {
          "en": "National equivalent",
          "sv": "Nationell motsvarighet"
        }[locale],
        "title": {
          "en": "National goal",
          "sv": "Nationell målbana"
        }[locale],
        "seriesName": {
          "en": "National equivalent",
          "sv": "Nationell motsvarighet"
        }[locale]
      },
      "historicalData": {
        "title": {
          "en": "Historical",
          "sv": "Historisk"
        }[locale]
      }
    },
    "mainDeltaGraph": {
      "chartOptions": {
        "title": {
          "yearlyChangeIn": {
            "en": "Yearly change in",
            "sv": "Årlig förändring i"
          }[locale],
          "percent": {
            "en": "percent",
            "sv": "procent"
          }[locale],
          "percentagePoints": {
            "en": "percentage points",
            "sv": "procentenheter"
          }[locale]
        },
        "seriesName": {
          "baseScenario": {
            "en": "Base scenario",
            "sv": "Basfall"
          }[locale],
          "expectedOutcome": {
            "en": "Expected outcome",
            "sv": "Förväntat utfall"
          }[locale],
          "nationalEquivalent": {
            "en": "National equivalent",
            "sv": "Nationell motsvarighet"
          }[locale]
        }
      },
      "ifBaselineDataSeries": {
        "baseScenario": {
          "en": "Base scenario",
          "sv": "Basfall"
        }[locale],
        "expectedOutcome": {
          "en": "Expected outcome",
          "sv": "Förväntat utfall"
        }[locale]
      },
      "ifNoBaselineIsSet": {
        "expectedOutcome": {
          "en": "Expected outcome",
          "sv": "Förväntat utfall"
        }[locale]
      },
      "secondaryGoal": {
        "title": {
          "yearlyChangeIn": {
            "en": "Yearly change in",
            "sv": "Årlig förändring i"
          }[locale],
          "percent": {
            "en": "percent",
            "sv": "procent"
          }[locale],
          "percentagePoints": {
            "en": "percentage points",
            "sv": "procentenheter"
          }[locale]
        }
      },
      "nationalGoal": {
        "name": {
          "en": "National equivalent",
          "sv": "Nationell motsvarighet"
        }[locale]
      }
    }
  },
  "graphSelector": {
    "graphSelector": {
      "handleSelectChange": {
        "invalidGraphType": {
          "en": "Invalid graph type",
          "sv": "Ogiltig graftyp"
        }[locale]
      },
      "return": {
        "options": {
          "main": {
            "en": "Goal",
            "sv": "Målbana"
          }[locale],
          "delta": {
            "en": "Yearly change",
            "sv": "Årlig förändring"
          }[locale],
          "relative": {
            "en": "Percentage change",
            "sv": "Procentuell förändring"
          }[locale]
        }
      }
    },
    "childGraphSelector": {
      "handleSelectChange": {
        "invalidGraphType": {
          "en": "Invalid graph type",
          "sv": "Ogiltig graftyp"
        }[locale]
      },
      "return": {
        "options": {
          "goals": {
            "en": "Goals",
            "sv": "Målbanor"
          }[locale],
          "expectedEffects": {
            "en": "Expected effects",
            "sv": "Förväntade utfall"
          }[locale]
        }
      }
    }
  },
  "functions": {
    "graphFunctions": {
      "getStoredGraphType": {
        "noValidGraphType": {
          "en": "Invalid graph type in storage, defaulting to main graph.",
          "sv": "Ogiltig graftyp i lagring, använder till huvudgraf."
        }[locale]
      },
      "getStoredChildGraphType": {
        "noValidGraphType": {
          "en": "Invalid graph type in storage, defaulting to main graph.",
          "sv": "Ogiltig graftyp i lagring, använder till huvudgraf."
        }[locale]
      }
    }
  },
  "childGraphs": {
    "predictionChildGraph": {
      "childOfChildGoals": {
        "unknownGoal": {
          "en": "Unknown goal",
          "sv": "Okänd målbana"
        }[locale]
      },
      "noDataToCompare": {
        "noUnderlyingGoals": {
          "en": "No underlying goals with effects or custom baselines found",
          "sv": "Inga underliggande målbanor med effekter eller anpassade baslinjer hittades"
        }[locale]
      }
    },
    "goalChildGraph": {
      "childOfChildGoals": {
        "unknownGoal": {
          "en": "Unknown goal",
          "sv": "Okänd målbana"
        }[locale]
      }
    },
    "childGraphContainer": {
      "menu": {
        "changeGraphType": {
          "en": "Change graph type",
          "sv": "Byt graftyp"
        }[locale],
        "changeGraphAlt": {
          "en": "Change graph",
          "sv": "Byt graf"
        }[locale]
      }
    }
  }
});