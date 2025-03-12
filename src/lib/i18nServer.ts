import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "node:path";
import { cookies } from "next/headers";
import { defaultNS, Locales, ns, titleCase, uniqueLocales } from "i18n.config";

// Create a separate i18next instance for server-side use
const serverI18n = i18next.createInstance({
  lng: cookies().get("locale")?.value ?? Locales.default,
});

// Initialize with sync mode to ensure translations are available immediately
serverI18n
  .use(Backend)
  .use({
    type: "postProcessor",
    name: "titleCase",
    process: titleCase,
  })
  .init({
    initImmediate: false, // This ensures synchronous loading 
    backend: {
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
    preload: uniqueLocales, // Preload all languages you support
    fallbackLng: Locales.default,
    supportedLngs: uniqueLocales,
    defaultNS: defaultNS,
    ns: ns,
    interpolation: {
      escapeValue: false,
    },
  });

export function t(key: string, options: object = {}) {
  return serverI18n.t(key, { ...options });
}

export default serverI18n;