
/* 
 * This file contains shared resources for the client and server instances of i18next.
 */

import { InitOptions, TFunction } from "i18next";

export enum Locales {
  en = "en",
  sv = "sv",
  default = en,
};
export const uniqueLocales = [...new Set(Object.values(Locales))];

export const defaultNS = "common";
export const ns = ["common", "forms", "components", "pages",];

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function initTemplate(t: TFunction): InitOptions {
  return {
    debug: false, // Set to true to get logs from i18next
    fallbackLng: Locales.default,
    supportedLngs: uniqueLocales,
    defaultNS,
    ns,
    interpolation: {
      escapeValue: false, // React already escapes
      format: (value, format, lng, options): string => {

        if (options && format === "titleCase") {
          return titleCase(t(options.interpolationkey));
        }

        return value || "";
      },
    },
  };
}