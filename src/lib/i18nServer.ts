import { createInstance, TFunction } from "i18next";
import { initTemplate, Locales } from "i18n.config";
import Backend from "i18next-fs-backend";
import path from "node:path";

export const i18nServer = createInstance();

export async function initI18nServer(locale: Locales) {
  i18nServer
    .use(Backend)
    .init({
      ...initTemplate(t as TFunction),
      initImmediate: false, // Synchronous loading, prevents showing unloaded keys
      lng: locale,
      backend: {
        // Get locale data by reading files with fs
        loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
      },
    });
  await i18nServer.changeLanguage(locale);
}

export const t = i18nServer.t;