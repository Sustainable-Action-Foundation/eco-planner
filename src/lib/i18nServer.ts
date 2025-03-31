import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { cookies, headers } from "next/headers";
import { createInstance, TFunction, TOptionsBase } from "i18next";
import { initTemplate, Locales, uniqueLocales } from "i18n.config";
import Backend from "i18next-fs-backend";
import path from "node:path";
import { getLocale } from "@/functions/getLocale";

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
  const locale = getLocale(
    cookies().get("locale")?.value,
    headers().get("accept-language"),
  );

  return i18nServer.t(key, { ...options, lng: locale });
}