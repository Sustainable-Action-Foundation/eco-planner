'use server';

import type { Locale } from "@/types";
import { headers } from "next/headers";

/**
 * Read locale i.e. "en" | "sv" from the http `locale` header.
 *  */
export async function getServerLocale() {
  // TODO: Make this clearer and add type guards + default locale
  // Right now it reads headers set by middleware.ts, which is not easy to see from this code.
  // Get the locale cookie or use the default locale
  return headers().get("locale") as Locale;
}

/** 
 * Throw error if JSON object is empty, indicating missing locale data.
 * @param dict JSON object.
*/
// This code has a duplicate in ./clientLocale.ts
export async function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("Locale dict is missing data.");
  }
}