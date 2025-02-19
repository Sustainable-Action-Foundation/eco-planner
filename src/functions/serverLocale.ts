import type { Locale } from "@/types";
import { headers } from "next/headers";

/**
 * Read locale i.e. "en" | "sv" from the http `locale` header.
 *  */
export function getServerLocale() {
  // Get the locale cookie or use the default locale
  return headers().get("locale") as Locale;
}

/** 
 * Throw error if JSON object is empty, indicating missing locale data.
 * @param dict JSON object.
*/
// This code has a duplicate in ./clientLocale.ts
export function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("Locale dict is missing data.");
  }
}