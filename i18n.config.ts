
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
    preload: uniqueLocales,
    defaultNS,
    ns,
    interpolation: {
      escapeValue: false, // React already escapes
      format: (value, format, lng, options): string => {
        if (!options) return value;

        value = value || t(options.interpolationkey);
        const formats = (format || "").split(",").map((f) => f.trim());

        /* Title case */
        if (options && formats.includes("titleCase")) {
          value = titleCase(value);
        }

        /* Possessive */
        if (options && formats.includes("possessive")) {
          if (lng === Locales.en) {
            if (["s", "x", "y"].includes(value.slice(-1))) {
              value = value + "'";
            } else {
              value = value + "'s";
            }
          }
          if (lng === Locales.sv) {
            if (["s", "x", "z"].includes(value.slice(-1))) {
              value = value + "'";
            } else {
              value = value + "s";
            }
          }
        }

        return value || "";
      },
    },
  };
}