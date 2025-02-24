"use client";

import type { Locale } from "@/types";
import { DEFAULT_LOCALE, LOCALES } from "@/constants";
import { useEffect, useState } from "react";
import { getCookie } from "cookies-next/client";

/**
 * Reads locale string i.e. "en" | "sv" from the client cookies.
 * @returns Locale string.
 */
export function useClientLocale() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const cookie = getCookie("language") as Locale;

  useEffect(() => {
    if (cookie && LOCALES.includes(cookie)) {
      setLocale(cookie);

    } else {
      console.warn("No language cookie or valid browser preference found. Using default locale.");
      setLocale(DEFAULT_LOCALE);
    }
  }, [cookie]);

  return locale;
}

/** 
 * Throw error if JSON object is empty, indicating missing locale data.
 * @param dict JSON object.
*/
// This code has a duplicate in ./serverLocale.ts
export function validateDict(dict: object | string) {
  if (typeof dict === "string") return; // We don't care about the actual translation

  if (Object.keys(dict).length === 0) {
    throw new Error("Locale dict is missing data.");
  }

  // If Leaf
  // If any key is a string, the object should be a leaf
  if (Object.values(dict).some(value => typeof value === "string")) {

    // If leaf has too many or too few locales
    if (Object.keys(dict).length !== LOCALES.length) {
      throw new Error("Locale leaf has the wrong amount of `Locale`s defined.");
    }

    // If leaf has an invalid locale
    if (Object.keys(dict).some(key => !LOCALES.includes(key as Locale))) {
      throw new Error("Locale leaf has an invalid Locale.");
    }
  }


}