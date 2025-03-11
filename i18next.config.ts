import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { Locales } from "@/types";

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: Locales.default,
    supportedLngs: [...new Set(Object.values(Locales))],
    defaultNS: "common",
    ns: ["common", "forms"],
    debug: process.env.NODE_ENV === "development", // TODO: remove this line entirely since NODE_ENV is evil https://nodejs.org/en/learn/getting-started/nodejs-the-difference-between-development-and-production
    interpolation: {
      escapeValue: false, // Not needed for react as it escapes by default
    },
    react: {
      useSuspense: false, // Better for server side rendering
    },
    backend: {
      // Custom API endpoint for loading translations
      loadPath: '/api/locales?lng={{lng}}&ns={{ns}}',
    },
  });

export default i18n;