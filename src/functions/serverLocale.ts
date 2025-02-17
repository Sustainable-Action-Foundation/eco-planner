import type { Locale } from "@/types";
import { DEFAULT_LOCALE } from "@/constants";
import { headers } from "next/headers";

/**
 * @description Read locale eg. "en" | "sv" from the http `locale` header.
 *  */
export function getServerLocale() {
  // Get the locale cookie or use the default locale
  return headers().get("locale") as Locale || DEFAULT_LOCALE as Locale;
}

/** 
 * @description Throw error if JSON object is empty.
 * @param dict JSON object.
*/
// This code has a duplicate in ./serverLocale.ts
export function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("dict is missing data.");
  }
}