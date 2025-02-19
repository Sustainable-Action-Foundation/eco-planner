"use client";

import { DEFAULT_LOCALE, LOCALES } from "@/constants";
import type { Locale } from "@/types";
// TODO - ESLint does not like these import.
import { getCookie } from "cookies-next";
import { useEffect, useState } from "react";

/**
 * Read locale i.e. "en" | "sv" from the clients cookies via the `language` cookie.
 * @returns Locale string.
 */
export function getClientLocale() {
  // TODO - Reconsider the use of `useState` and `useEffect` in this function.
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const cookie = getCookie("language") as Locale

  useEffect(() => {
    if (cookie && LOCALES.includes(cookie)) {
      setLocale(cookie);
    } else if (navigator.languages && navigator.languages.some((language) => LOCALES.includes(language as Locale))) {
      console.info("No language cookie found. Using browser language.");

      const languages = navigator.languages;
      for (const language of languages) {
        if (LOCALES.includes(language as Locale)) {
          setLocale(language as Locale);
          break;
        }
      }
    } else {
      console.warn("No language cookie or preference found. Using default locale.");
    }
  }, [cookie]);

  return locale;
}

/** 
 * Throw error if JSON object is empty, indicating missing locale data.
 * @param dict JSON object.
*/
// This code has a duplicate in ./serverLocale.ts
export function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("Locale dict is missing data.");
  }
}