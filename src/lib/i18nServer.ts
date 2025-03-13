import { createInstance } from 'i18next';
import Backend from "i18next-fs-backend";
import path from "node:path";
import { cookies } from "next/headers";
import { defaultNS, Locales, ns, titleCase, uniqueLocales } from "i18n.config";
import { match } from "@formatjs/intl-localematcher";

// Create a new i18n instance for each request to ensure we get the latest cookie
const createI18nInstance = () => {
  // Read the current locale from cookies
  const cookieLocale = cookies().get("locale")?.value;

  // Sanitize locale
  const locale = cookieLocale
    ? match([cookieLocale], uniqueLocales, Locales.default)
    : Locales.default;

  // Create a fresh instance
  const i18nInstance = createInstance();

  i18nInstance
    .use(Backend)
    .use({
      type: "postProcessor",
      name: "titleCase",
      process: titleCase,
    })
    .init({
      initImmediate: false, // Synchronous loading
      lng: locale,
      backend: {
        loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
      },
      preload: uniqueLocales,
      fallbackLng: Locales.default,
      supportedLngs: uniqueLocales,
      defaultNS: defaultNS,
      ns: ns,
      interpolation: {
        escapeValue: false, // React already escapes
      },
    });

  return i18nInstance;
};

const serverI18n = createI18nInstance();

export function t(key: string, options: object = {}) {
  // Get a fresh instance with the current cookie value
  const i18nInstance = createI18nInstance();
  return i18nInstance.t(key, { ...options });
}

export default serverI18n;