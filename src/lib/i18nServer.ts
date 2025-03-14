import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { cookies } from "next/headers";
import { createInstance, Module, TFunction, TOptionsBase } from "i18next";
import { initTemplate, Locales, titleCaseProcess, uniqueLocales } from "i18n.config";
import { match } from "@formatjs/intl-localematcher";
import Backend from "i18next-fs-backend";
import path from "node:path";

const i18nServer = createInstance();
i18nServer
  .use(Backend)
  .use(titleCaseProcess as Module)
  .init({
    ...initTemplate(t as TFunction),
    initImmediate: false, // Synchronous loading
    backend: {
      // Get locale data by reading files with fs
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
  });

// Create a new i18n instance for each request to ensure we get the latest cookie
const createI18nInstance = () => {
  // Read the current locale from cookies
  const cookieLocale = cookies().get("locale")?.value;

  // Sanitize locale
  const locale = cookieLocale
    ? match([cookieLocale], uniqueLocales, Locales.default)
    : Locales.default;

  // Create a fresh instance
  i18nServer.changeLanguage(locale);

  return i18nServer;
};

const serverI18n = createI18nInstance();

export function t(key: string | string[], options?: (TOptionsBase & $Dictionary) | undefined) {
  // Get a fresh instance with the current cookie value
  const i18nServer = createI18nInstance();
  return i18nServer.t(key, options || {});
}

export default serverI18n;