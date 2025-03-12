export enum Locales {
  en = "en",
  sv = "sv",
  default = en,
};
export const uniqueLocales = [...new Set(Object.values(Locales))];

export const ns = ["common", "forms", "components",];
export const defaultNS = "common";

export function titleCase(value: string, key: string, options: object) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}