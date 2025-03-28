"use client";

import { initTemplate, Locales } from "i18n.config";
import { createInstance, t, TFunction } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

const i18nClient = createInstance();

export default function I18nProvider(
  { children, lng }: { children: React.ReactNode, lng: string }
) {
  i18nClient
    .use(Backend)
    .use(initReactI18next)
    .init({
      ...initTemplate(t as TFunction),
      lng: lng,
      backend: {
        // Get locale data by fetching API route
        loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
      },
    });

  return <I18nextProvider i18n={i18nClient}>{children}</I18nextProvider>;
}


// "use client";

// import { initTemplate, Locales, uniqueLocales } from "i18n.config";
// import { I18nextProvider, initReactI18next } from "react-i18next";
// import i18nClient, { t, TFunction } from "i18next";
// import { match } from "@formatjs/intl-localematcher";
// import Backend from "i18next-http-backend";
// import { useEffect, useState } from "react";

// i18nClient
//   .use(Backend)
//   .use(initReactI18next)
//   .init({
//     ...initTemplate(t as TFunction),
//     backend: {
//       // Get locale data by fetching API route
//       loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
//     },
//   });

// /** React component that wraps all translatable client side content */
// export default function I18nProvider(
//   { children, lng }: { children: React.ReactNode, lng: string }
// ) {
//   // // Locale passed from server side
//   // i18nClient.language = match([lng], uniqueLocales, Locales.default);
//   // console.debug("initial client language", lng, "or", i18nClient.language);

//   // const [isI18nInitialized, setIsI18nInitialized] = useState(false);
//   // const [forceUpdate, setForceUpdate] = useState(0);

//   // useEffect(() => {
//   //   const initI18n = async () => {
//   //     // Get locale form provider
//   //     const cleanLocale = match([lng], uniqueLocales, Locales.default);

//   //     i18nClient.changeLanguage(cleanLocale);

//   //     return setIsI18nInitialized(true);
//   //   };

//   //   initI18n();

//   //   // Listen for language changes and force a context refresh
//   //   const handleLanguageChange = () => {
//   //     setForceUpdate(prev => prev + 1);
//   //   };
//   //   window.addEventListener("i18n-language-changed", handleLanguageChange);
//   //   return () => window.removeEventListener("i18n-language-changed", handleLanguageChange); // Cleanup
//   // }, [lng]);

//   // if (!isI18nInitialized) {
//   //   return null;
//   // }
//   const forceUpdate = 0;

//   // The key prop forces the I18nextProvider to re-mount when language changes
//   return <I18nextProvider i18n={i18nClient} key={`i18n-provider-${forceUpdate}`}>{children}</I18nextProvider>;
// }