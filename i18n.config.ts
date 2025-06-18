
/* 
 * This file contains shared resources for the client and server instances of i18next.
 */

import { createInstance, InitOptions, TFunction } from "i18next";

export enum Locales {
  enSE = "en-SE",
  svSE = "sv-SE",
  default = enSE,
};
export const uniqueLocales = [...new Set(Object.values(Locales))];
export const localeAliases: Record<Locales, string> = {
  [Locales.enSE]: "English",
  [Locales.svSE]: "Svenska",
};

export const allNamespaces = ["common", "forms", "components", "graphs", "pages", "email", "test", "metadata"];

const i18nFormatter = createInstance();
i18nFormatter.init({});

export function initTemplate(t: TFunction): InitOptions {
  return {
    debug: false, // Set to true to get logs from i18next
    fallbackLng: Locales.default,
    supportedLngs: uniqueLocales,
    defaultNS: false,
    ns: "common",
    interpolation: {
      escapeValue: false, // React already escapes
      format: (formatterValue, format, lng, options): string => {
        /** 
         * `format` is a requirement for the *formatter* of course.
         * `options.interpolationkey` is required as it stores the value to be formatted.
         * `uniqueLocales` is a check to ensure that the locale is supported.
         */
        if (!format || !options || !options.interpolationkey || !uniqueLocales.includes(lng as Locales)) return "";
        /** There can be multiple formats */
        const formats = format.split(",").map((f) => f.trim()).filter(Boolean);

        // Resolve the value with provided key
        let value: string | undefined = options.interpolationkey.includes("$t(") ? t(options.interpolationkey) : options.interpolationkey;

        // Guard against undefined values
        if (typeof value === "undefined") {
          console.warn(`Value for key "${options.interpolationkey}" is undefined (Value: ${value}, type: ${typeof value}). Check the key and the translation file. Returning empty string.`);
          return "";
        }

        // At this point a value is likely defined so if there are no formats, return the value
        if (formats.length < 1) return value;


        /* Default formatters */
        const defaultFormat = i18nFormatter.format(formatterValue, format, lng, options);
        if (defaultFormat && typeof defaultFormat === "string") {
          value = defaultFormat;
        }
        /* Title case */
        if (formats.includes("titleCase")) {
          value = titleCase(value, lng);
        }
        /* Possessive */
        if (formats.includes("possessive")) {
          value = possessive(value, lng);
        }
        /* Relative time */
        if (formats.includes("timeAgo")) {
          const date = options.date;
          value = relativeTime(value, lng, date);
        }


        // Guard against undefined values
        if (!value) {
          console.warn(`A formatter likely failed to return a value (returned: ${value}, type: ${typeof value}). Check the formatter for errors. Setting value to empty string.`);
          value = "";
        }
        return value;
      },
    },
  };
}

function titleCase(value: string | undefined, lng: string | undefined): string | undefined {
  if (typeof value !== "string") {
    console.warn(`Value passed to titleCase formatter is not a string. Received: ${value}, type: ${typeof value}. Returning value as is.`);
    return value;
  }

  if (!value) {
    console.warn("Value passed to titleCase formatter is empty. Returning value as is.");
    return value;
  }

  if (!lng) {
    console.warn("Title case formatter requires a locale to be set. Returning value as is.");
    return value;
  }

  if (lng === Locales.enSE) {
    // https://en.wikipedia.org/wiki/Title_case
    return value.replace(/\b\w+\b/g, (word) => {
      if (word.length > 3) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      } else {
        return word.toLowerCase();
      }
    });
  }
  else if (lng === Locales.svSE) {
    // https://sv.wikipedia.org/wiki/Versalisering#I_egennamn
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  else {
    console.warn(`Title case formatter not implemented for locale: ${lng}. Returning value as is.`);
    return value;
  }
}

function possessive(value: string | undefined, lng: string | undefined): string | undefined {
  if (typeof value !== "string") {
    console.warn(`Value passed to possessive formatter is not a string. Received: ${value}, type: ${typeof value}. Returning value as is.`);
    return value;
  }

  if (!lng) {
    console.warn("Possessive formatter requires a locale to be set. Returning value as is.");
    return value;
  }

  if (lng === Locales.enSE) {
    // https://en.wikipedia.org/wiki/Genitive_case
    if (["s", "x", "y"].includes(value.slice(-1))) {
      value = value + "'";
    } else {
      value = value + "'s";
    }
  }
  else if (lng === Locales.svSE) {
    // https://sv.wikipedia.org/wiki/Genitiv
    if (["s", "x", "z"].includes(value.slice(-1))) {
      // Nothing
    } else {
      value = value + "s";
    }
  }
  else {
    console.warn(`Possessive formatter not implemented for locale: ${lng}. Returning value as is.`);
  }

  return value;
}

function relativeTime(value: string | undefined, lng: string | undefined, date: Date | undefined): string | undefined {
  if (!lng) {
    console.warn("Relative time formatter requires a locale to be set. Returning value as is.");
    return value;
  }
  if (!date) {
    console.warn("Relative time formatter requires a date to be set. Returning value as is.");
    return value;
  }

  if (isNaN(date.getTime())) {
    console.warn(`Invalid date provided for relative time formatter. Received: ${value}, type: ${typeof value}. Returning value as is.`);
    return value;
  }

  const relativeTime = new Intl.RelativeTimeFormat(lng);

  const dayDelta = Math.round((date.getTime() - Date.now()) / (86_400_000));
  const hourDelta = Math.round((date.getTime() - Date.now()) / (3_600_000));
  const minuteDelta = Math.round((date.getTime() - Date.now()) / (60_000));
  const secondDelta = Math.round((date.getTime() - Date.now()) / (1_000));

  if (isNaN(dayDelta) || isNaN(hourDelta) || isNaN(minuteDelta) || isNaN(secondDelta)) {
    console.error(`Invalid date provided for relative time calculations. Received: ${value}, type: ${typeof value}. Returning value as is.`);
    return value;
  }

  if (Math.abs(dayDelta) > 0) return relativeTime.format(dayDelta, "days");
  if (Math.abs(hourDelta) > 0) return relativeTime.format(hourDelta, "hours");
  if (Math.abs(minuteDelta) > 0) return relativeTime.format(minuteDelta, "minutes");
  if (Math.abs(secondDelta) > 0) return relativeTime.format(secondDelta, "seconds");

  return relativeTime.format(secondDelta, "seconds");
}