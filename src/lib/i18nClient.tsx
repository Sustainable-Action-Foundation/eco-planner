"use client";

import { initTemplate, Locales, ns, uniqueLocales } from "i18n.config";
import { getCookie } from "cookies-next";
import { I18nextProvider } from "react-i18next";
import { initReactI18next } from "react-i18next";
import { match } from "@formatjs/intl-localematcher";
import { useEffect, useState } from "react";
import Backend from "i18next-http-backend";
import i18nClient, { t, TFunction } from "i18next";

i18nClient
  .use(Backend)
  .use(initReactI18next)
  .init({
    ...initTemplate(t as TFunction),
    backend: {
      // Get locale data by fetching API route
      loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
    },
  });
i18nClient.changeLanguage(match([...navigator.languages], uniqueLocales, Locales.default));
console.log("Client side i18n initialized with:", i18nClient.language);

/** React component that wraps all translatable client side content */
export default function I18nProvider(
  { children }: { children: React.ReactNode }
) {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const initI18n = async () => {
      const cookieLang = await getCookie("locale");

      // If cookie exists, respect that language
      if (cookieLang && i18nClient.language !== cookieLang) {
        await i18nClient.changeLanguage(match([cookieLang], uniqueLocales, Locales.default));
        return setIsI18nInitialized(true);
      }

      return setIsI18nInitialized(true);
    };

    initI18n();

    // Listen for language changes and force a context refresh
    const handleLanguageChange = () => {
      setForceUpdate(prev => prev + 1);
    };
    window.addEventListener("i18n-language-changed", handleLanguageChange);
    return () => window.removeEventListener("i18n-language-changed", handleLanguageChange); // Cleanup
  }, []);

  if (!isI18nInitialized) {
    return null;
  }

  // The key prop forces the I18nextProvider to re-mount when language changes
  return <I18nextProvider i18n={i18nClient} key={`i18n-provider-${forceUpdate}`}>{children}</I18nextProvider>;
}