"use client";

import { initTemplate, Locales } from "i18n.config";
import i18nClient, { t } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { useEffect, useState, createContext } from "react";

i18nClient
  .use(Backend)
  .use(initReactI18next)
  .init({
    ...initTemplate(t),
    backend: {
      loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
    },
  });

export const LocaleContext = createContext<Locales>(Locales.default);
export const LocaleSetterContext = createContext<React.Dispatch<React.SetStateAction<Locales>>>(() => {});

export default function I18nProvider(
  { children, lng }: { children: React.ReactNode, lng: Locales }
) {
  // This initialize state prevents the app from rendering (and rerendering forever) before the language is set
  const [isInitialized, setInitialized] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [locale, setLocale] = useState(lng);

  // Handler for changing the language on locale change
  useEffect(() => {
    const setI18nLanguage = async () => {
      await i18nClient.changeLanguage(locale);
      setInitialized(true);
    };

    setI18nLanguage();
  }, [locale]);

  // Handler for rerendering
  useEffect(() => {
    // Define a listener for language changes
    const localeChangeListener = () => setForceRender((prev) => prev + 1);
    // Set and clean up the listener
    window.addEventListener("i18n-language-changed", localeChangeListener);
    return () => window.removeEventListener("i18n-language-changed", localeChangeListener);
  }, []);

  if (!isInitialized) return null;

  return (
    <LocaleContext.Provider value={locale}>
      <LocaleSetterContext.Provider value={setLocale}>
        {/* The key will be updated on language switch to force a rerender */}
        <I18nextProvider key={`i18n-provider-force-update-${forceRender}`} i18n={i18nClient}>
          {children}
        </I18nextProvider>
      </LocaleSetterContext.Provider>
    </LocaleContext.Provider>
  );
}