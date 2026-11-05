"use client";

import { initTemplate, Locales, possessive, relativeTime, titleCase } from "@root/i18n.config";
import i18nClient from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { useEffect, useState, createContext } from "react";
import { patchI18nT } from "@/lib/informativeCimodeT";

i18nClient
  .use(Backend)
  .use(initReactI18next)
  .init({
    ...initTemplate(),
    backend: {
      loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
    },
  }).catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("i18nClient initialization failed:", errorMessage);
  });

patchI18nT(i18nClient);

if (!i18nClient.services.formatter) {
  console.warn("i18nServer formatter is not available. Custom formatters will not be added.");
}

i18nClient.services.formatter?.add("titleCase", titleCase);
i18nClient.services.formatter?.add("possessive", possessive);
i18nClient.services.formatter?.add("timeAgo", relativeTime);

export const LocaleContext = createContext<Locales>(Locales.default);
export const LocaleSetterContext = createContext<React.Dispatch<React.SetStateAction<Locales>>>(() => { /* empty */ });

export default function I18nProvider(
  { children, lng }: { children: React.ReactNode, lng: Locales },
) {
  // This initialize state prevents the app from rendering (and rerendering forever) before the language is set
  const [isInitialized, setInitialized] = useState(false);
  const [locale, setLocale] = useState(lng);

  // Handler for changing the language on locale change. react-i18next's hooks (useTranslation,
  // Trans) subscribe to the instance's languageChanged event and re-render themselves with the
  // new text, so nothing below is keyed or remounted: a remount here would wipe every form the
  // user is in the middle of filling out (the language switcher sits in the sidebar of each page).
  useEffect(() => {
    const setI18nLanguage = async () => {
      await i18nClient.changeLanguage(locale);
      setInitialized(true);
    };

    void setI18nLanguage();
  }, [locale]);

  if (!isInitialized) return null;

  return (
    <LocaleContext.Provider value={locale}>
      <LocaleSetterContext.Provider value={setLocale}>
        <I18nextProvider i18n={i18nClient}>
          {children}
        </I18nextProvider>
      </LocaleSetterContext.Provider>
    </LocaleContext.Provider>
  );
}
