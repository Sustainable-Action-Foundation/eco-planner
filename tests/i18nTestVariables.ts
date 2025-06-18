/** The locale type */
export enum Locales { enSE = "en-SE", svSE = "sv-SE", default = enSE, };

/** All locales */
export const uniqueLocales = [...new Set(Object.values(Locales))];

/** The language switcher uses these values */
export const localeAliases = { [Locales.enSE]: "English", [Locales.svSE]: "Svenska", };

/** All namespaces */
export const namespaces = ["common", "forms", "components", "graphs", "pages", "email", "metadata",];

/** Where the locale files are located relative to project root. */
export const localesDir = "public/locales";
