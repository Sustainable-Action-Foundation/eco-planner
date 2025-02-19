"use client";

import type { Locale } from "@/types";
import { DEFAULT_LOCALE, LOCALES } from "@/constants";
import { useEffect, useState } from "react";
import { getCookie } from "cookies-next/client";

/**
 * Reads locale string i.e. "en" | "sv" from the client cookies and the browser preferences as a fallback.
 * @returns Locale string.
 */
export function getClientLocale() {
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
export function validateDict(dict: object) {
  if (Object.keys(dict).length === 0) {
    throw new Error("Locale dict is missing data.");
  }
}