"use client";

import { allNamespaces, initTemplate, Locales, possessive, relativeTime, titleCase } from "@root/i18n.config";
import { createInstance, type i18n, type ResourceLanguage } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { useEffect, useState, createContext } from "react";
import { patchI18nT } from "@/lib/informativeCimodeT";

/**
 * An i18next instance that is ready synchronously: it starts in `lng` with that language's
 * translations already in its store, so the first render (on the server and at hydration)
 * produces real text without fetching anything. Other languages are fetched when switched to.
 */
function createI18n(lng: Locales, resources: ResourceLanguage): i18n {
  const instance = createInstance();
  // The server only ever renders the one language it was handed
  if (typeof window !== "undefined") {
    instance.use(Backend).use(initReactI18next);
  }

  instance
    .init({
      ...initTemplate(),
      lng,
      ns: allNamespaces,
      resources: { [lng]: resources },
      initAsync: false,
      backend: {
        loadPath: "/api/locales?lng={{lng}}&ns={{ns}}",
      },
    }).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("i18nClient initialization failed:", errorMessage);
    });

  patchI18nT(instance);

  if (!instance.services.formatter) {
    console.warn("i18nClient formatter is not available. Custom formatters will not be added.");
  }

  instance.services.formatter?.add("titleCase", titleCase);
  instance.services.formatter?.add("possessive", possessive);
  instance.services.formatter?.add("timeAgo", relativeTime);

  return instance;
}

export const LocaleContext = createContext<Locales>(Locales.default);
export const LocaleSetterContext = createContext<React.Dispatch<React.SetStateAction<Locales>>>(() => { /* empty */ });

/**
 * @param lng - The request's locale, as the server resolved it
 * @param resources - That locale's translations by namespace (see clientResources in i18nServer)
 */
export default function I18nProvider(
  { children, lng, resources }: { children: React.ReactNode, lng: Locales, resources: ResourceLanguage },
) {
  // One instance per mounted provider, never a module-level one: on the server the module is
  // shared by every request in the process, and a shared instance would leak one request's
  // language into another's render.
  const [i18nClient] = useState(() => createI18n(lng, resources));
  const [locale, setLocale] = useState(lng);

  // Handler for changing the language on locale change. react-i18next's hooks (useTranslation,
  // Trans) subscribe to the instance's languageChanged event and re-render themselves with the
  // new text, so nothing below is keyed or remounted: a remount here would wipe every form the
  // user is in the middle of filling out (the language switcher sits in the sidebar of each page).
  useEffect(() => {
    if (i18nClient.language === locale) return;

    const setI18nLanguage = async () => {
      // The instance was started with bundled resources, so i18next does not fetch a
      // language on its own when switching to it
      if (locale !== Locales.test && !i18nClient.hasResourceBundle(locale, "common")) {
        await i18nClient.reloadResources(locale, allNamespaces);
      }
      await i18nClient.changeLanguage(locale);
    };

    void setI18nLanguage();
  }, [i18nClient, locale]);

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
