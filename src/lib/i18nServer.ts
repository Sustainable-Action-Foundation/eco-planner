import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { cookies } from "next/headers";
import { createInstance, TFunction, TOptionsBase } from "i18next";
import { initTemplate, Locales, uniqueLocales } from "i18n.config";
import { match } from "@formatjs/intl-localematcher";
import Backend from "i18next-fs-backend";
import path from "node:path";

export const i18nServer = createInstance();
i18nServer
  .use(Backend)
  .init({
    ...initTemplate(t as TFunction),
    initImmediate: false, // Synchronous loading
    backend: {
      // Get locale data by reading files with fs
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
  });

export async function t(key: string | string[], options?: (TOptionsBase & $Dictionary) | undefined) {
  // Get locale from cookies
  const cookieLocale = await cookies().get("locale")?.value;
  // Sanitize locale
  const locale = cookieLocale
    ? match([cookieLocale], uniqueLocales, Locales.default)
    : Locales.default;

  // Change the language
  await i18nServer.changeLanguage(locale);

  return i18nServer.t(key, options || {});
}