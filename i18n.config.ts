
/* 
 * This file contains shared resources for the client and server instances of i18next.
*/

import type { InitOptions, TOptions as RealTOptions } from "i18next";
import { createInstance } from "i18next";

export type TOptions = Omit<RealTOptions, "context"> & { context?: string };

export const Locales = {
  test: "cimode",
  enSE: "en-SE",
  svSE: "sv-SE",
  default: "en-SE",
} as const;
export type Locales = (typeof Locales)[keyof typeof Locales];
export const uniqueLocales = [...new Set(Object.values(Locales))];
export const localeAliases: Record<Locales, string> = {
  [Locales.enSE]: "English",
  [Locales.svSE]: "Svenska",
  [Locales.test]: "Test",
};

export const allNamespaces = ["common", "forms", "components", "graphs", "pages", "email", "metadata", "api"];

const i18nFormatter = createInstance();
i18nFormatter.init({}).catch((err: unknown) => {
  if (err instanceof Error) {
    throw new Error(`i18nFormatter initialization failed: ${err}`);
  } else {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`i18nFormatter initialization failed with non-error-typed error: ${err}`);
  }
});

export function initTemplate(): InitOptions {
  return {
    debug: false, // Set to true to get logs from i18next
    fallbackLng: Locales.default,
    supportedLngs: uniqueLocales,
    defaultNS: false,
    ns: "common",
    interpolation: {
      escapeValue: false, // React already escapes
    },
  };
}

export function titleCase<T>(value: T, lng: string | undefined): string | T {
  if (typeof value !== "string") {
    console.warn(`Value passed to titleCase formatter is not a string. Received: ${JSON.stringify(value)}, type: ${typeof value}. Returning value as is.`);
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

export function possessive<T>(value: T, lng: string | undefined): string | T {
  if (typeof value !== "string") {
    console.warn(`Value passed to possessive formatter is not a string. Received: ${JSON.stringify(value)}, type: ${typeof value}. Returning value as is.`);
    return value;
  }

  if (!lng) {
    console.warn("Possessive formatter requires a locale to be set. Returning value as is.");
    return value;
  }

  let result: string = value;
  if (lng === Locales.enSE) {
    // https://en.wikipedia.org/wiki/Genitive_case
    if (["s", "x", "y"].includes(value.slice(-1))) {
      result = result + "'";
    } else {
      result = result + "'s";
    }
  }
  else if (lng === Locales.svSE) {
    // https://sv.wikipedia.org/wiki/Genitiv
    if (["s", "x", "z"].includes(value.slice(-1))) {
      // Nothing
    } else {
      result = result + "s";
    }
  }
  else {
    console.warn(`Possessive formatter not implemented for locale: ${lng}. Returning value as is.`);
  }

  return result;
}
export function relativeTime<T>(value: T, lng: string | undefined): string | T {
  if (!lng) {
    console.warn("Relative time formatter requires a locale to be set. Returning value as is.");
    return value;
  }
  if (!(value instanceof Date)) {
    console.warn(`Relative time formatter requires a Date value. Received: ${JSON.stringify(value)}, type: ${typeof value}. Returning value as is.`);
    return value;
  }
  if (isNaN(value.getTime())) {
    console.warn(`Invalid date provided for relative time formatter. Received: ${JSON.stringify(value)}. Returning value as is.`);
    return value;
  }

  const relativeTime = new Intl.RelativeTimeFormat(lng);
  const now = Date.now();

  const dayDelta = Math.round((value.getTime() - now) / 86_400_000);
  const hourDelta = Math.round((value.getTime() - now) / 3_600_000);
  const minuteDelta = Math.round((value.getTime() - now) / 60_000);
  const secondDelta = Math.round((value.getTime() - now) / 1_000);

  if (Math.abs(dayDelta) > 0) return relativeTime.format(dayDelta, "days");
  if (Math.abs(hourDelta) > 0) return relativeTime.format(hourDelta, "hours");
  if (Math.abs(minuteDelta) > 0) return relativeTime.format(minuteDelta, "minutes");
  return relativeTime.format(secondDelta, "seconds");
}
