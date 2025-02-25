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