import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "notifications": {
    "notification": {
      "notifications": {
        "notificationsAlt": {
          "en": "notifications",
          "sv": "notifikationer"
        }[locale]
      }
    }
  },
  "header": {
    "sidebar": {
      "aside": {
        "toggleMenu": {
          "en": "Toggle menu",
          "sv": "Växla meny"
        }[locale],
        "aside": {
          "nav": {
            "myAccount": {
              "en": "My account",
              "sv": "Mitt konto"
            }[locale],
            "createAccount": {
              "en": "Create account",
              "sv": "Skapa konto"
            }[locale],
            "home": {
              "en": "Home",
              "sv": "Hem"
            }[locale],
            "aboutTheTool": {
              "en": "About the tool",
              "sv": "Om verktyget"
            }[locale],
            "login": {
              "en": "Login",
              "sv": "Logga in"
            }[locale]
          }
        }
      }
    }
  }
});