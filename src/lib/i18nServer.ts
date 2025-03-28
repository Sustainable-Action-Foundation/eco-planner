import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { cookies, headers } from "next/headers";
import { createInstance, TFunction, TOptionsBase } from "i18next";
import { initTemplate, Locales, uniqueLocales } from "i18n.config";
import { match } from "@formatjs/intl-localematcher";
import Backend from "i18next-fs-backend";
import path from "node:path";

const i18nServer = createInstance();

export function initI18nServer(locale: Locales) {
  i18nServer
    .use(Backend)
    .init({
      ...initTemplate(t as TFunction),
      initImmediate: false, // Synchronous loading, prevents showing unloaded keys
      lng: locale,
      preload: uniqueLocales,
      backend: {
        // Get locale data by reading files with fs
        loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
      },
    });
  i18nServer.changeLanguage(locale);
}

export function t(key: string | string[], options?: (TOptionsBase & $Dictionary) | undefined) {
  let locale = Locales.default;

  const localeCookie = cookies().get("locale")?.value;
  const xLocaleHeader = headers().get("x-locale");
  const acceptLanguageHeader = headers().get("accept-language") || "";
  if (localeCookie) {
    // Sanitize the locale
    const cleanLocale = match([localeCookie], uniqueLocales, Locales.default);
    locale = cleanLocale as Locales;
  }
  else if (xLocaleHeader) {
    // Sanitize the locale
    const cleanLocale = match([xLocaleHeader], uniqueLocales, Locales.default);
    locale = cleanLocale as Locales;
  }
  else {
    // Sanitize the locale
    const cleanLocale = match([acceptLanguageHeader], uniqueLocales, Locales.default);
    locale = cleanLocale as Locales;
  }
  
  return i18nServer.t(key, { ...options, lng: locale });
}