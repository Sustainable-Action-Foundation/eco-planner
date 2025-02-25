"use client";

import { Locale } from "@/types";
import { useEffect, useState } from "react";
import { getCookie } from "cookies-next/client";

/**
 * Reads locale string i.e. "en" | "sv" from the client cookies.
 * @returns Locale string.
 */
export function useClientLocale() {
  const [locale, setLocale] = useState<Locale>(Locale.default);
  const cookie = getCookie("language") as Locale;

  useEffect(() => {
    if (cookie && Object.values(Locale).includes(cookie)) {
      setLocale(cookie);

    } else {
      console.warn("No language cookie or valid browser preference found. Using default locale.");
      setLocale(Locale.default);
    }
  }, [cookie]);

  return locale;
}