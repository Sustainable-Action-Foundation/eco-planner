"use client";

import { initTemplate, Locales, titleCaseProcess, uniqueLocales } from "i18n.config";
import { getCookie } from "cookies-next";
import { I18nextProvider } from "react-i18next";
import { initReactI18next } from "react-i18next";
import { match } from "@formatjs/intl-localematcher";
import { useEffect, useState } from "react";
import Backend from "i18next-http-backend";
import i18n, { Module, t } from "i18next";

i18n
  .use(Backend)
  .use(titleCaseProcess as Module)
  .use(initReactI18next)
  .init({
    ...initTemplate(t),
    backend: {
      // Get locale data by fetching API route
      loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
    },
  });


/** React component that wraps all translatable content */
export default function I18nProvider(
  { children }: { children: React.ReactNode }
) {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const initI18n = async () => {
      const cookieLang = await getCookie("locale");

      // If cookie exists, respect that language
      if (cookieLang && i18n.language !== cookieLang) {
        await i18n.changeLanguage(match([cookieLang], uniqueLocales, Locales.default));
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
  return <I18nextProvider i18n={i18n} key={`i18n-provider-${forceUpdate}`}>{children}</I18nextProvider>;
}