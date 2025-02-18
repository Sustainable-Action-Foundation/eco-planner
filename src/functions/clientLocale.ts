"use client";

import type { Locale } from "@/types";
import { DEFAULT_LOCALE } from "@/constants";
// TODO - ESLint does not like these import.
import { useEffect, useState } from "react";
import { getCookie } from "cookies-next";

/**
 * Read locale i.e. "en" | "sv" from the clients cookies via the `language` cookie.
 */
export function getClientLocale() {
  // TODO - Reconsider the use of `useState` and `useEffect` in this function.
  const [locale, setLocale] = useState<Locale | null>(null);
  const cookie = getCookie("language") as Locale
  useEffect(() => {
    if (cookie) {
      setLocale(cookie);
    } else {
      console.warn("No language cookie found. Using default locale.");
    }
  }, [cookie]);
  return locale || DEFAULT_LOCALE as Locale;
}

/** 
 * Throw error if JSON object is empty.
 * @param dict JSON object.
*/
// This code has a duplicate in ./serverLocale.ts
export function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("dict is missing data.");
  }
}