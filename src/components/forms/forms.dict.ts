import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "formWrapper": {
    "back": {
      "en": "Back",
      "sv": "Tillbaka",
    }[locale],
    "next": {
      "en": "Next",
      "sv": "Nästa",
    }[locale],
  },
  "userInfo": {
    "signup": {
      "handleSubmit": {
        "signupFailedForReason": {
          "en": "Signup failed.\nReason: ",
          "sv": "Registrering misslyckades.\nAnledning: ",
        }[locale],
        "signupFailed": {
          "en": "Signup failed.",
          "sv": "Registrering misslyckades.",
        }[locale],
      },
      "signup": {
        "title": {
          "en": "Create account",
          "sv": "Skapa konto",
        }[locale],
        "username": {
          "label": {
            "en": "Username",
            "sv": "Användarnamn",
          }[locale],
          "placeholder": {
            "en": "username",
            "sv": "användarnamn",
          }[locale],
        },
        "email": {
          "label": {
            "en": "Email",
            "sv": "E-postadress",
          }[locale],
          "placeholder": {
            "en": "email",
            "sv": "e-postadress",
          }[locale],
        },
        "password": {
          "label": {
            "en": "Password",
            "sv": "Lösenord",
          }[locale],
          "placeholder": {
            "en": "password",
            "sv": "lösenord",
          }[locale],
        },
        "submit": {
          "createAccount": {
            "en": "Create account",
            "sv": "Skapa konto",
          }[locale],
        },
        "haveAnAccount": {
          "label": {
            "en": "Do you already have an account?",
            "sv": "Har du redan ett konto?",
          }[locale],
          "login": {
            "en": "Login",
            "sv": "Logga in",
          }[locale],
        },
        "information": {
          "en": "Your organization must have signed a user agreement with us for you to be able to create an account.\nFor questions or concerns, please contact",
          "sv": "Din organisation måste ha tecknat ett användaravtal med oss för att du ska kunna skapa ett konto.\nVid frågor eller funderingar, vänligen kontakta",
        }[locale],
      },
    },
    "login": {
      "handleSubmit": {
        "loginFailed": {
          "en": "Login failed.",
          "sv": "Inloggning misslyckades.",
        }[locale],
      },
      "login": {
        "title": {
          "en": "Login",
          "sv": "Logga in",
        }[locale],
        "username": {
          "label": {
            "en": "Username",
            "sv": "Användarnamn",
          }[locale],
          "placeholder": {
            "en": "username",
            "sv": "användarnamn",
          }[locale],
        },
        "password": {
          "label": {
            "en": "Password",
            "sv": "Lösenord",
          }[locale],
          "placeholder": {
            "en": "password",
            "sv": "lösenord",
          }[locale],
        },
        "rememberMe": {
          "en": "Remember me",
          "sv": "Kom ihåg mig",
        }[locale],
        "forgotPassword": {
          "en": "Forgot password?",
          "sv": "Glömt lösenordet?",
        }[locale],
        "submit": {
          "login": {
            "en": "Login",
            "sv": "Logga in",
          }[locale],
        },
        "noAccount": {
          "label": {
            "en": "Don't have an account?",
            "sv": "Har du inget konto?",
          }[locale],
          "createAccount": {
            "en": "Create account",
            "sv": "Skapa konto",
          }[locale],
          "verifyAccount": {
            "en": "Verify account",
            "sv": "Verifiera konto",
          }[locale],
        },
      },
    },
  },
  "roadmapForm": {
    "roadmapForm": {
      "badDecoding": {
        "alert": {
          "en": "The file seems to use an unknown encoding as the interpreted text contains the character '�' which indicates that some character could not be interpreted correctly (probably Å, Ä or Ö).\nYou can still use this file, but if you are not completely sure that it *should* contain the character '�' it is recommended that you convert the file to UTF-8 encoding and try again.",
          "sv": "Filen verkar använda en okänd encoding då den tolkade texten innehåller tecknet '�' som indikerar att något tecken inte kunde tolkas korrekt (antagligen Å, Ä eller Ö).\nDu kan fortfarande använda den här filen, men om du inte är helt säker på att den *ska* innehålla tecknet '�' så rekommenderas att du konverterar filen till UTF-8 encoding och försöker igen.",
        }[locale],
      },
      "roadmapForm": {
        "handleSubmit": {
          "columnNotSupported": {
            "en": "Column 'Scale' is not supported and will be ignored.",
            "sv": "Kolumnen 'Scale' stöds inte och kommer att ignoreras.",
          }[locale],
          "versionCouldNotBeCreated": {
            "en": "Roadmap version could not be created.\nReason:",
            "sv": "Färdplansversion kunde inte skapas.\nAnledning:",
          }[locale],
          "unknownError": {
            "en": "Unknown error",
            "sv": "Okänt fel",
          }[locale],
        },
        "useEffect": {
          "columnNotSupported": {
            "en": "Column 'Scale' is not supported and will be ignored. If the column contains any scales, please bake them into the unit or value instead. Example: unit 'MW' rather than unit 'kW' with scale 'thousand'.",
            "sv": "Kolumnen 'Scale' stöds inte och kommer att ignoreras. Om kolumnen innehåller några skalor, vänligen baka in dem i enheten eller värdet istället. Exempel: enhet 'MW' snarare än enhet 'kW' med skala 'tusen'",
          }[locale],
          "fileCouldNotBeRead": {
            "en": "File could not be read:",
            "sv": "Filen kunde inte läsas:",
          }[locale],
          "unknownError": {
            "en": "Unknown error",
            "sv": "Okänt fel",
          }[locale],
        },
        "form": {
          "metaRoadmap": {
            "relationToOtherPosts": {
              "en": "Enter the relation to other posts",
              "sv": "Ange relationen till andra inlägg",
            }[locale],
            "metaRoadmapThatThisIsPostIn": {
              "en": "Meta roadmap that this is a new post in",
              "sv": "Färdplansserie som detta är ett nytt inlägg i",
            }[locale],
            "noMetaRoadmapSelected": {
              "en": "No meta roadmap selected",
              "sv": "Ingen färdplansserie vald",
            }[locale],
            "noAccessibleMetaRoadmaps": {
              "en": "You seem to not have access to any meta roadmaps",
              "sv": "Du verkar inte ha tillgång till några färdplansserier",
            }[locale],
            "roadmapVersion": {
              "versionOfMetaRoadmap": {
                "en": (targetName: string) => `Version of the roadmap series ${targetName} this roadmap version is working towards`,
                "sv": (targetName: string) => `Version av färdplansserien ${targetName} den här färdplansversionen arbetar mot`,
              }[locale],
              "noAlternativeSelected": {
                "en": "No alternative selected",
                "sv": "Inget alternativ valt",
              }[locale],
              "alwaysMostRecent": {
                "en": "Always most recent version",
                "sv": "Alltid senaste versionen",
              }[locale],
              "version": {
                "en": "Version",
                "sv": "Version",
              }[locale],
            },
          },
          "description": {
            "describe": {
              "en": "Describe the roadmap version",
              "sv": "Beskriv färdplansversionen",
            }[locale],
            "extraDescription": {
              "en": "Extra description of this roadmap version",
              "sv": "Extra beskrivning av den här färdplansversionen",
            }[locale],
          },
          "goals": {
            "upload": {
              "en": "Upload goals",
              "sv": "Ladda upp målbanor",
            }[locale],
            "goals": {
              "en": "Goals",
              "sv": "Målbanor",
            }[locale],
            "acceptedFileTypes": {
              "en": "accepted file types: .csv, accepted encoding: UTF-8",
              "sv": "accepterade filtyper: .csv, accepterad encoding: UTF-8",
            }[locale],
          },
          "inheritableGoals": {
            "chooseGoal": {
              "en": "Choose a goal to inherit",
              "sv": "Välj ett mål att ärva",
            }[locale],
          },
          "viewingPrivileges": {
            "adjust": {
              "en": "Adjust viewing privileges",
              "sv": "Justera läsbehörighet",
            }[locale],
          },
          "editingPrivileges": {
            "adjust": {
              "en": "Adjust editing privileges",
              "sv": "Justera redigeringsbehörighet",
            }[locale],
          },
          "submit": {
            "save": {
              "en": "Save roadmap version",
              "sv": "Spara färdplansversion",
            }[locale],
            "create": {
              "en": "Create roadmap version",
              "sv": "Skapa färdplansversion",
            }[locale],
          },
        },
      },
    },
  },
  "pxWeb": {
    "queryBuilder": {
      "addHistoricalData": {
        "en": "Add historical data",
        "sv": "Lägg till historisk data",
      }[locale],
      "addDataSource": {
        "en": "Add data source",
        "sv": "Lägg till datakälla",
      }[locale],
      "addHistoricalMetadata": {
        "en": "Add historical metadata to",
        "sv": "Lägg till historisk dataserie till",
      }[locale],
      "dataSource": {
        "dataSource": {
          "en": "Data source",
          "sv": "Datakälla",
        }[locale],
        "chooseSource": {
          "en": "Choose a source",
          "sv": "Välj en källa",
        }[locale],
        "searchForTable": {
          "en": "Search for table",
          "sv": "Sök efter tabell",
        }[locale],
        "search": {
          "en": "Search",
          "sv": "Sök",
        }[locale],
      },
      "tableDetails": {
        "chooseValues": {
          "en": "Choose values for table",
          "sv": "Välj värden för tabell",
        }[locale],
        "chooseValue": {
          "en": "Choose a value",
          "sv": "Välj ett värde",
        }[locale],
      },
      "tableContentCheck": {
        "doesThisLookCorrect": {
          "en": "Does this look reasonable? (showing max 5 values)",
          "sv": "Ser detta rimligt ut? (visar max 5 värden)",
        }[locale],
        "timePeriod": {
          "en": "Time period",
          "sv": "Period",
        }[locale],
        "value": {
          "en": "Value",
          "sv": "Värde",
        }[locale],
      },
      "noReadableResult": {
        "en": "No readable result found. Please update your selections.",
        "sv": "Inget läsbart resultat hittades. Vänligen uppdatera dina val.",
      }[locale],
      "submit": {
        "addDataSource": {
          "en": "Add data source",
          "sv": "Lägg till datakälla",
        }[locale],
      },
    },
  },
  "metaRoadmapForm": {
    "metaRoadmapForm": {
      "describeMetaRoadmap": {
        "title": {
          "en": "Describe your meta roadmap",
          "sv": "Beskriv din färdplansserie",
        }[locale],
        "name": {
          "en": "Name for the new meta roadmap",
          "sv": "Namn för den nya färdplansserien",
        }[locale],
        "description": {
          "en": "Description of the new meta roadmap",
          "sv": "Beskrivning av den nya färdplansserien",
        }[locale],
      },
      "actor": {
        "chooseResponsibleActor": {
          "en": "Choose responsible actor",
          "sv": "Välj ansvarig aktör",
        }[locale],
        "typeOfMetaRoadmap": {
          "en": "Type of meta roadmap",
          "sv": "Typ av färdplansserie",
        }[locale],
        "chooseType": {
          "en": "Choose a type",
          "sv": "Välj en typ",
        }[locale],
        "chooseActor": {
          "en": "Choose an actor",
          "sv": "Välj en aktör",
        }[locale],
      },
      "externalResources": {
        "attach": {
          "en": "Attach external resources",
          "sv": "Bifoga externa resurser",
        }[locale],
      },
      "viewingPrivileges": {
        "adjust": {
          "en": "Adjust viewing privileges",
          "sv": "Justera läsbehörighet",
        }[locale],
      },
      "editingPrivileges": {
        "adjust": {
          "en": "Adjust editing privileges",
          "sv": "Justera skrivbehörighet",
        }[locale],
      },
      "parentMetaRoadmap": {
        "title": {
          "en": "Does this meta roadmap work towards another meta roadmap?",
          "sv": "Jobbar denna färdplansserie mot en annan färdplansserie?",
        }[locale],
        "parent": {
          "en": "Parent",
          "sv": "Förälder",
        }[locale],
        "noParent": {
          "en": "No parent",
          "sv": "Ingen förälder",
        }[locale],
      },
      "submit": {
        "save": {
          "en": "Save meta roadmap",
          "sv": "Spara färdplansserie",
        }[locale],
        "create": {
          "en": "Create meta roadmap",
          "sv": "Skapa färdplansserie",
        }[locale],
      },
    },
  },
  "linkInput": {
    "linkInput": {
      "linkInput": {
        "name": {
          "en": "Name",
          "sv": "Namn",
        }[locale],
        "link": {
          "en": "Link",
          "sv": "Länk",
        }[locale],
      },
    },
  },
  "goalForm": {
    "goalFormSections": {
      "manualGoalForm": {
        "leapParameter": {
          "en": "LEAP parameter",
          "sv": "LEAP-parameter",
        }[locale],
        "unit": {
          "unit": {
            "en": "Unit for data series",
            "sv": "Enhet för dataserie",
          }[locale],
          "parseAs": {
            "en": "Unit is parsed as:",
            "sv": "Enheten tolkas som:",
          }[locale],
          "parseError": {
            "en": "The unit could not be parsed. You can still save the goal, but some functionality may be missing.",
            "sv": "Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.",
          }[locale],
        },
        "extraInfo": {
          "extraInfo": {
            "en": "Extra information about data series",
            "sv": "Extra information om dataserie",
          }[locale],
          "infoDescription": {
            "en": "The field \"Data series\" accepts a series of values separated by semicolon or tab, which means you can paste a series of values from Excel or similar.\n\n\nNOTE: Values must not be separated by comma (\",\").\n\nDecimal numbers can use either decimal point or decimal comma.\n\nThe first value represents year 2020 and the series can continue up to year 2050 (total of 31 values).\n\nIf values are missing for a year, you can leave it empty, for example, \";1;;;;5\" can be used to specify values 1 and 5 for years 2021 and 2025.",
            "sv": "Fältet \"Dataserie\" tar emot en serie värden separerade med semikolon eller tabb, vilket innebär att du kan klistra in en serie värden från Excel eller liknande.\n\nOBS: Värden får inte vara separerade med komma (\",\").\n\nDecimaltal kan använda antingen decimalpunkt eller decimalkomma.\n\nDet första värdet representerar år 2020 och serien kan fortsätta maximalt till år 2050 (totalt 31 värden).\n\nOm värden saknas för ett år kan du lämna det tomt, exempelvis kan \";1;;;;5\" användas för att ange värdena 1 och 5 för år 2021 och 2025.",
          }[locale],
        },
        "dataSeries": {
          "dataSeries": {
            "en": "Data series",
            "sv": "Dataserie",
          }[locale],
          "input": {
            "title": {
              "en": "Use numerical values separated by semicolon or tab. Decimal numbers can use either dot or comma.",
              "sv": "Använd numeriska värden separerade med semikolon eller tabb. Decimaltal kan använda antingen punkt eller komma.",
            }[locale],
          },
        },
      },
      "inheritedGoalForm": {
        "roadmapVersion": {
          "chooseToInheritFrom": {
            "en": "Select a roadmap version to inherit a goal from",
            "sv": "Välj en färdplansversion att ärva en målbana från",
          }[locale],
          "choose": {
            "en": "Choose roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "goal": {
            "en": "goal",
            "sv": "mål",
          }[locale],
        },
        "roadmapData": {
          "chooseToInheritFrom": {
            "en": "Select a goal to inherit data from",
            "sv": "Välj en målbana att ärva data från",
          }[locale],
          "choose": {
            "en": "Choose goal",
            "sv": "Välj målbana",
          }[locale],
          "namelessGoal": {
            "en": "Nameless goal",
            "sv": "Namnlöst mål",
          }[locale],
          "unitMissing": {
            "en": "Unit missing",
            "sv": "Enhet saknas",
          }[locale],
        },
        "leapParameter": {
          "en": "LEAP parameter",
          "sv": "LEAP-parameter",
        }[locale],
        "unit": {
          "unit": {
            "en": "Unit for data series",
            "sv": "Enhet för dataserie",
          }[locale],
          "parseAs": {
            "en": "Unit is parsed as:",
            "sv": "Enheten tolkas som:",
          }[locale],
          "parseError": {
            "en": "The unit could not be parsed. You can still save the goal, but some functionality may be missing.",
            "sv": "Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.",
          }[locale],
        },
      },
      "combinedGoalForm": {
        "leapParameter": {
          "en": "LEAP parameter",
          "sv": "LEAP-parameter",
        }[locale],
        "unit": {
          "unit": {
            "en": "Unit for data series",
            "sv": "Enhet för dataserie",
          }[locale],
          "parseAs": {
            "en": "Unit is parsed as:",
            "sv": "Enheten tolkas som:",
          }[locale],
          "parseError": {
            "en": "The unit could not be parsed. You can still save the goal, but some functionality may be missing.",
            "sv": "Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.",
          }[locale],
        },
        "goals": {
          "chooseGoals": {
            "en": "Select goals in the current roadmap version to combine",
            "sv": "Välj målbanor i den aktuella färdplansversionen som ska kombineras",
          }[locale],
          "tip": {
            "en": "Tip: use <kbd><kbd>CTRL</kbd> + <kbd>F</kbd></kbd> to find the goals you are looking for",
            "sv": "Tips: använd <kbd><kbd>CTRL</kbd> + <kbd>F</kbd></kbd> för att hitta målbanorna du söker efter",
          }[locale],
          "namelessGoal": {
            "en": "Nameless goal",
            "sv": "Namnlöst mål",
          }[locale],
          "unitMissing": {
            "en": "Unit missing",
            "sv": "Enhet saknas",
          }[locale],
          "invertGoal": {
            "en": "Invert goal (divide by this goal's target instead of multiplying)",
            "sv": "Invertera målet (dividera med denna målban istället för att multiplicera)",
          }[locale],
        },
      },
      "inheritingBaseline": {
        "roadmapVersion": {
          "chooseToInheritFrom": {
            "en": "Select a roadmap version to inherit the goal from",
            "sv": "Välj en färdplansversion att ärva målbanan från",
          }[locale],
          "choose": {
            "en": "Choose roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "goal": {
            "en": "goal",
            "sv": "mål",
          }[locale],
        },
        "roadmapData": {
          "chooseToUseAsBaseline": {
            "en": "Select a goal to use as baseline (values will be copied instead of linked)",
            "sv": "Välj en målbana att använda som baslinje (värdena kopieras istället för att länkas)",
          }[locale],
          "choose": {
            "en": "Choose goal",
            "sv": "Välj målbana",
          }[locale],
          "dataMissing": {
            "en": "DATA MISSING; ",
            "sv": "DATA SAKNAS; ",
          }[locale],
          "namelessGoal": {
            "en": "Nameless goal",
            "sv": "Namnlöst mål",
          }[locale],
          "unitMissing": {
            "en": "Unit missing",
            "sv": "Enhet saknas",
          }[locale],
        },
        "goalData": {
          "baseline": {
            "en": "Baseline, copied from selected goal",
            "sv": "Baslinje, kopierad från vald målbana",
          }[locale],
        },
      },
    },
    "goalForm": {
      "selectRoadmap": {
        "title": {
          "en": "Select roadmap version to create goal under:",
          "sv": "Välj färdplansversion att skapa målbanan under:",
        }[locale],
        "dropdown": {
          "title": {
            "en": "Select roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "placeholder": {
            "en": "Select roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "actions": {
            "en": "actions",
            "sv": "åtgärder",
          }[locale],
        },
      },
      "dataSeries": {
        "title": {
          "en": "Select type of data series for your goal",
          "sv": "Välj typ av dataserie för din målbana",
        }[locale],
        "dropdown": {
          "title": {
            "en": "Data series",
            "sv": "Dataserie",
          }[locale],
          "static": {
            "en": "Static",
            "sv": "Statisk",
          }[locale],
          "inherited": {
            "en": "Inherited",
            "sv": "Ärvd",
          }[locale],
          "combined": {
            "en": "Combined",
            "sv": "Kombinerad",
          }[locale],
        },
      },
      "describeGoal": {
        "title": {
          "en": "Describe your goal",
          "sv": "Beskriv din målbana",
        }[locale],
        "name": {
          "en": "Name of goal",
          "sv": "Namn på målbanan",
        }[locale],
        "description": {
          "en": "Description of goal",
          "sv": "Beskrivning av målbanan",
        }[locale],
      },
      "goalStructure": {
        "title": {
          "en": "Describe how your goal's data is structured",
          "sv": "Beskriv hur din målbanas data är utformad",
        }[locale],
        "dataSeries": {
          "title": {
            "en": "Data series",
            "sv": "Dataserie",
          }[locale],
          "scaling": {
            "remove": {
              "en": "Remove scaling",
              "sv": "Ta bort skalning",
            }[locale],
            "add": {
              "en": "Add scaling",
              "sv": "Lägg till skalning",
            }[locale],
            "methods": {
              "title": {
                "en": "Scaling method:",
                "sv": "Skalningsmetod:",
              }[locale],
              "geometric": {
                "en": "Geometric",
                "sv": "Geometrisk",
              }[locale],
              "algebraic": {
                "en": "Algebraic",
                "sv": "Algebraisk",
              }[locale],
              "multiplicative": {
                "en": "Multiplicative",
                "sv": "Multiplikativ",
              }[locale],
            },
            "result": {
              "en": "Resulting data series",
              "sv": "Resulterande dataserie",
            }[locale],
          },
        },
      },
      "baseline": {
        "title": {
          "en": "Select a goal to use as baseline",
          "sv": "Välj en målbana att använda som baslinje",
        }[locale],
        "dropdown": {
          "title": {
            "en": "Baseline",
            "sv": "Baslinje",
          }[locale],
          "initial": {
            "en": "Initial",
            "sv": "Initial",
          }[locale],
          "custom": {
            "en": "Custom",
            "sv": "Anpassad",
          }[locale],
          "inherited": {
            "en": "Inherited",
            "sv": "Ärvd",
          }[locale],
        },
        "customBaseline": {
          "title": {
            "en": "Custom baseline",
            "sv": "Anpassad baslinje",
          }[locale],
          "hoverText": {
            "en": "Use numerical values separated by semicolon or tab. Decimal numbers can use either dot or comma.",
            "sv": "Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma.",
          }[locale],
        },
      },
      "externalResources": {
        "title": {
          "en": "Attach external resources",
          "sv": "Bifoga externa resurser",
        }[locale],
      },
      "featureGoal": {
        "title": {
          "en": "Feature this goal",
          "sv": "Lyft fram denna målbanan",
        }[locale],
        "checkboxLabel": {
          "en": "Feature this goal",
          "sv": "Lyft fram denna målbanan",
        }[locale],
      },
      "scaleWarning": {
        "title": {
          "en": "The goal contains a scale. Please bake the scale into the value or unit and then check this box; all scales will be removed in the future",
          "sv": "Målbanan innehåller en skala. Vänligen baka in skalan i värdet eller enheten och checka sedan i den här rutan; alla skalor kommer att tas bort i framtiden",
        }[locale],
        "checkboxLabel": {
          "en": "Remove scale",
          "sv": "Ta bort skalan",
        }[locale],
      },
      "submit": {
        "save": {
          "en": "Save goal",
          "sv": "Spara målbana",
        }[locale],
        "create": {
          "en": "Create goal",
          "sv": "Skapa målbana",
        }[locale],
      },
    },
  },
  "filters": {
    "roadmapFilters": {
      "menu": {
        "searchRoadmaps": {
          "en": "Search roadmaps",
          "sv": "Sök bland färdplaner",
        }[locale],
        "sortBy": {
          "en": "Sort by:",
          "sv": "Sortera efter:",
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
          "goalsFalling": {
            "en": "Amount of goals (falling)",
            "sv": "Antal målbanor (fallande)",
          }[locale],
          "goalsRising": {
            "en": "Amount of goals (rising)",
            "sv": "Antal målbanor (stigande)",
          }[locale],
        },
        "filter": {
          "en": "Filter",
          "sv": "Filtrera",
        }[locale],
      },
      "roadmapFiltersMenu": {
        "show": {
          "en": "Show",
          "sv": "Visa",
        }[locale],
        "filterOptions": {
          "roadmapTypes": {
            "national": {
              "en": "national",
              "sv": "nationella",
            }[locale],
            "regional": {
              "en": "regional",
              "sv": "regionala",
            }[locale],
            "municipal": {
              "en": "municipal",
              "sv": "kommunala",
            }[locale],
            "local": {
              "en": "local",
              "sv": "lokala",
            }[locale],
            "other": {
              "en": "other",
              "sv": "övriga",
            }[locale],
          },
          "roadmaps": {
            "en": "roadmaps",
            "sv": "färdplaner",
          }[locale],
        },
      },
    },
    "userFilters": {
      "posts": {
        "en": "Posts",
        "sv": "Inlägg",
      }[locale],
      "roadmap": {
        "en": "Roadmap",
        "sv": "Färdplan",
      }[locale],
      "roadmapSeries": {
        "en": "Roadmap series",
        "sv": "Färdplansserie",
      }[locale],
      "clearance": {
        "en": "Clearance",
        "sv": "Behörighet",
      }[locale],
      "editingPrivileges": {
        "en": "Editing privileges",
        "sv": "Redigeringsbehörighet",
      }[locale],
    },
  },
  "effectForm": {
    "effectFormSections": {
      "actionSelector": {
        "selectRoadmapVersion": {
          "title": {
            "en": "Select roadmap version that the action belongs to",
            "sv": "Välj färdplansversion som åtgärden hör till",
          }[locale],
          "selectRoadmapVersion": {
            "en": "Select roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "actions": {
            "en": "actions",
            "sv": "åtgärder",
          }[locale],
        },
        "selectAction": {
          "title": {
            "en": "Select action to add the effect under",
            "sv": "Välj åtgärd att lägga effekten under",
          }[locale],
          "selectAction": {
            "en": "Select action",
            "sv": "Välj åtgärd",
          }[locale],
          "existingEffects": {
            "en": "existing effects",
            "sv": "befintliga effekter",
          }[locale],
        },
      },
      "goalSelector": {
        "selectRoadmapVersion": {
          "title": {
            "en": "Select roadmap version that the goal belongs to",
            "sv": "Välj färdplansversion som målbanan hör till",
          }[locale],
          "selectRoadmapVersion": {
            "en": "Select roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "goals": {
            "en": "goals",
            "sv": "målbanor",
          }[locale],
        },
        "selectRoadmap": {
          "title": {
            "en": "Select roadmap to affect",
            "sv": "Välj målbana att påverka",
          }[locale],
          "selectRoadmap": {
            "en": "Select roadmap",
            "sv": "Välj målbana",
          }[locale],
          "namelessGoal": {
            "en": "Nameless goal",
            "sv": "Namnlöst mål",
          }[locale],
          "unitMissing": {
            "en": "Unit missing",
            "sv": "Enhet saknas",
          }[locale],
        },
      },
    },
    "effectForm": {
      "dataSeries": {
        "title": {
          "en": "Data series",
          "sv": "Data serie",
        }[locale],
        "hoverText": {
          "en": "Use numeric values separated by semicolon or tab. Decimal numbers can use either dot or comma.",
          "sv": "Använd numeriska värden separerade med semikolon eller tabb. Decimaltal kan använda antingen punkt eller komma.",
        }[locale],
      },
      "impactType": {
        "title": {
          "en": "What type of impact does the action have?",
          "sv": "Vilken typ av påverkan har åtgärden?",
        }[locale],
        "absolute": {
          "en": "Absolute difference from baseline",
          "sv": "Absolut skillnad gentemot baslinjen",
        }[locale],
        "delta": {
          "en": "Change year by year (delta)",
          "sv": "Förändring år för år (delta)",
        }[locale],
        "percent": {
          "en": "Difference from baseline in percent of previous year's total value (baseline + actions)",
          "sv": "Skillnad gentemot baslinjen i procent av föregående års totalvärde (baslinje + åtgärder)",
        }[locale],
      },
      "createButton": {
        "save": {
          "en": "Save effect",
          "sv": "Spara effekt",
        }[locale],
        "create": {
          "en": "Create effect",
          "sv": "Skapa effekt",
        }[locale],
      },
    },
  },
  "actionForm": {
    "actionForm": {
      "selectRoadmapSection": {
        "title": {
          "en": "Relation to other posts",
          "sv": "Relation till andra inlägg",
        }[locale],
        "enterRelation": {
          "en": "Enter relation to other posts",
          "sv": "Ange relationen till andra inlägg",
        }[locale],
        "selectRoadmapVersionDropdown": {
          "title": {
            "en": "Select roadmap version to create action under",
            "sv": "Välj färdplansversion att skapa åtgärd under",
          }[locale],
          "placeholder": {
            "en": "Select roadmap version",
            "sv": "Välj färdplansversion",
          }[locale],
          "actions": {
            "en": "actions",
            "sv": "åtgärder",
          }[locale],
        },
      },
      "descriptionSection": {
        "title": {
          "en": "Describe your action",
          "sv": "Beskriv din åtgärd",
        }[locale],
        "nameOfAction": {
          "en": "Name of action",
          "sv": "Namn på åtgärden",
        }[locale],
        "descriptionOfAction": {
          "en": "Description of action",
          "sv": "Beskrivning av åtgärden",
        }[locale],
        "costEfficiency": {
          "en": "Cost efficiency",
          "sv": "Kostnadseffektivitet",
        }[locale],
        "expectedResult": {
          "en": "Expected result",
          "sv": "Förväntat resultat",
        }[locale],
      },
      "expectedImpactSection": {
        "title": {
          "en": "Enter expected effect of the action",
          "sv": "Ange förväntad effekt av åtgärden",
        }[locale],
        "type": {
          "absolute": {
            "en": "Absolute difference compared to baseline",
            "sv": "Absolut skillnad gentemot baslinje",
          }[locale],
          "delta": {
            "en": "Change year by year (delta)",
            "sv": "Förändring år för år (delta)",
          }[locale],
          "percent": {
            "en": "Difference compared to baseline in percentage of previous year's total value (baseline + actions)",
            "sv": "Skillnad gentemot baslinjen i procent av föregående års totalvärde (baslinje + åtgärder)",
          }[locale],
        },
        "dataSeries": {
          "title": {
            "en": "Data series",
            "sv": "Dataserie",
          }[locale],
          "hoverText": {
            "en": "Use numeric values separated with semicolon or tab. Decimal numbers can use either dot or comma.",
            "sv": "Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma.",
          }[locale],
          "dropdown": {
            "title": {
              "en": "Additional information about the data series",
              "sv": "Extra information om dataserie",
            }[locale],
            "info": {
              "en": "The field \"Data series\" accepts a series of values separated with semicolon or tab, which means you can paste a series of values from Excel or similar.\n\nNOTE: Values must not be separated with comma (\",\")\n\nDecimal numbers can use either decimal point or decimal comma.\n\nThe first value represents year 2020 and the series can continue up to year 2050 (total of 31 values).\n\nIf values are missing for a year, you can leave it empty, for example, \";1;;;;5\" can be used to specify the values 1 and 5 for years 2021 and 2025.",
              "sv": "Fältet \"Dataserie\" tar emot en serie värden separerade med semikolon eller tab, vilket innebär att du kan klistra in en serie värden från Excel eller liknande.\n\nOBS: Värden får inte vara separerade med komma (\",\").\n\nDecimaltal kan använda antingen decimalpunkt eller decimalkomma.\n\nDet första värdet representerar år 2020 och serien kan fortsätta maximalt till år 2050 (totalt 31 värden).\n\nOm värden saknas för ett år kan du lämna det tomt, exempelvis kan \";1;;;;5\" användas för att ange värdena 1 och 5 för år 2021 och 2025.",
            }[locale],
          },
        },
      },
      "startingYearSection": {
        "title": {
          "en": "Choose years for the action",
          "sv": "Välj pågående år för din åtgärd",
        }[locale],
        "startingYear": {
          "en": "Starting year",
          "sv": "Startår",
        }[locale],
        "endingYear": {
          "en": "Ending year",
          "sv": "Slutår",
        }[locale],
      },
      "actorsSection": {
        "title": {
          "en": "Describe the actors involved in the action",
          "sv": "Beskriv aktörer för din åtgärd",
        }[locale],
        "projectManager": {
          "en": "Project manager",
          "sv": "Projektansvarig",
        }[locale],
        "relevantActors": {
          "en": "Relevant actors",
          "sv": "Relevanta aktörer",
        }[locale],
      },
      "categoriesSection": {
        "title": {
          "en": "What categories does the action fall under?",
          "sv": "Vilka kategorier faller åtgärden under?",
        }[locale],
        "sufficiency": {
          "en": "Sufficiency",
          "sv": "Tillräcklighet",
        }[locale],
        "efficiency": {
          "en": "Efficiency",
          "sv": "Effektivitet",
        }[locale],
        "renewables": {
          "en": "Renewables",
          "sv": "Förnybara",
        }[locale],
      },
      "externalResourcesSection": {
        "title": {
          "en": "Attach external resources",
          "sv": "Bifoga externa resurser",
        }[locale],
      },
      "submitSection": {
        "save": {
          "en": "Save action",
          "sv": "Spara åtgärd",
        }[locale],
        "create": {
          "en": "Create action",
          "sv": "Skapa åtgärd",
        }[locale],
      },
    },
  },
  "accessSelector": {
    "accessSelector": {
      "editUsers": {
        "groups": {
          "editingPrivileges": {
            "en": "Groups with editing privileges",
            "sv": "Grupper med redigeringsbehörigheter",
          }[locale],
        },
        "users": {
          "editingPrivileges": {
            "en": "Users with editing privileges",
            "sv": "Användare med redigeringsbehörigheter",
          }[locale],
          "removeUser": {
            "en": "Remove user",
            "sv": "Ta bort användare",
          }[locale],
          "addUser": {
            "en": "Add user",
            "sv": "Lägg till användare",
          }[locale],
        },
      },
      "viewUsers": {
        "groups": {
          "readingPrivileges": {
            "en": "Groups with reading privileges",
            "sv": "Grupper med läsbehörigheter",
          }[locale],
          "viewPostPublicly": {
            "en": "View post publicly",
            "sv": "Visa inlägg offentligt",
          }[locale],
        },
        "users": {
          "readingPrivileges": {
            "en": "Users with reading privileges",
            "sv": "Användare med läsbehörigheter",
          }[locale],
          "removeUser": {
            "en": "Remove user",
            "sv": "Ta bort användare",
          }[locale],
          "addUser": {
            "en": "Add user",
            "sv": "Lägg till användare",
          }[locale],
        },
      },
    },
  },
});