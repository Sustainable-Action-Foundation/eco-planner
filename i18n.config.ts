
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

export const ns = ["common", "forms", "components", "pages", "email", "test",];

export function initTemplate(t: TFunction): InitOptions {
  return {
    debug: false, // Set to true to get logs from i18next
    fallbackLng: Locales.default,
    supportedLngs: uniqueLocales,
    defaultNS: "common",
    ns: ns,
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

        /* Relative time */
        if (options && formats.includes("relativeTime")) {
          value = relativeTime(new Date(value), lng || Locales.default);
        }

        return value || "";
      },
    },
  };
}

export function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function relativeTime(date: Date, lng: string) {
  if (!date) {
    console.error("No date provided for relative time calculation");
    return "";
  }
  if (date.constructor.name !== "Date") {
    console.error("Invalid date provided for relative time calculation");
    return "";
  }

  const relativeTime = new Intl.RelativeTimeFormat(lng);

  const dayDelta = Math.round((date.getTime() - Date.now()) / (86_400_000));
  const hourDelta = Math.round((date.getTime() - Date.now()) / (3_600_000));
  const minuteDelta = Math.round((date.getTime() - Date.now()) / (60_000));
  const secondDelta = Math.round((date.getTime() - Date.now()) / (1_000));

  if (isNaN(dayDelta) || isNaN(hourDelta) || isNaN(minuteDelta) || isNaN(secondDelta)) {
    console.error("Invalid date provided for relative time calculation. NaN");
    return "";
  }

  if (Math.abs(dayDelta) > 0) return relativeTime.format(dayDelta, "days");
  if (Math.abs(hourDelta) > 0) return relativeTime.format(hourDelta, "hours");
  if (Math.abs(minuteDelta) > 0) return relativeTime.format(minuteDelta, "minutes");
  if (Math.abs(secondDelta) > 0) return relativeTime.format(secondDelta, "seconds");

  return relativeTime.format(secondDelta, "seconds");
}