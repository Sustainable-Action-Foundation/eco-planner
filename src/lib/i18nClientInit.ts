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
    supportedLngs: uniqueLocales,
    defaultNS: defaultNS,
    ns: ns,
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