"use client";

import type { Locale } from "@/types";
import { DEFAULT_LOCALE } from "@/constants";
/// // TODO - ESLint does not like these import.
// import { useEffect, useState } from "react";
// import { getCookie } from "cookies-next";

/**
 * Reads locale string i.e. "en" | "sv" from the <html> tags lang property.
 */
export function getClientLocale() {
  const locale = document.documentElement.lang as Locale;
  if (!locale) {
    console.warn("No language found in html lang. Using default locale.");

    // Fall back to reading og:locale meta tag.
    const metaLocale = document.querySelector("meta[property='og:locale']")?.getAttribute("content") as Locale;
    if (!metaLocale) {
      console.warn("No language found in og:locale meta tag. Using default locale.");
      return DEFAULT_LOCALE as Locale;
    }
    return metaLocale;
  }
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