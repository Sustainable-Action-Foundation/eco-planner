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

const I18nContext = createContext<Locales>(Locales.default);
const I18nSetterContext = createContext<(lng: Locales) => void>(() => { });
// const I18nSetterContext = createContext<React.Dispatch<React.SetStateAction<Locales>> | null>(null);


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

  // The key will be updated on language switch to force a rerender
  return (
    <I18nContext.Provider value={locale}>
      <I18nSetterContext.Provider value={setLocale}>
        <I18nextProvider key={`i18n-provider-force-update-${forceRender}`} i18n={i18nClient}>
          {children}
        </I18nextProvider>
      </I18nSetterContext.Provider>
    </I18nContext.Provider>
  );
}