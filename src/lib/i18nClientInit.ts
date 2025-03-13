import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { defaultNS, Locales, ns, titleCase, uniqueLocales } from "i18n.config";

i18n
  .use(Backend)
  .use({
    type: "postProcessor",
    name: "titleCase",
    process: titleCase,
  })
  .use(initReactI18next)
  .init({
    fallbackLng: Locales.default,
    preload: uniqueLocales,
    supportedLngs: uniqueLocales,
    defaultNS: defaultNS,
    ns: ns,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    backend: {
      // Custom API endpoint for loading translations
      loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
    },
  });

export default i18n;