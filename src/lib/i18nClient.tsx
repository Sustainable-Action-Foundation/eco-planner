"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18nClientInit";
import { getCookie } from "cookies-next";
import { Locales, uniqueLocales } from "i18n.config";
import { match } from "@formatjs/intl-localematcher";

export default function I18nProvider(
  { children }: { children: React.ReactNode }
) {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);
  // Add a force update state to ensure deep re-renders
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    const initI18n = async () => {
      const cookieLang = await getCookie("locale");

      // Try to read cookie lang (locale)
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

    window.addEventListener('i18n-language-changed', handleLanguageChange);
    return () => {
      window.removeEventListener('i18n-language-changed', handleLanguageChange);
    };
  }, []);

  if (!isI18nInitialized) {
    return null;
  }

  // The key prop forces the I18nextProvider to re-mount when language changes
  return <I18nextProvider i18n={i18n} key={`i18n-provider-${forceUpdate}`}>{children}</I18nextProvider>;
}