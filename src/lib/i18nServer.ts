"use server";

import i18nServer, { type TFunction } from "i18next";
import { initTemplate, Locales } from "i18n.config";
import Backend from "i18next-fs-backend";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/functions/getLocale.ts";

await i18nServer.use(Backend)
  .init({
    ...initTemplate(i18nServer.t as TFunction),
    initAsync: true,
    lng: Locales.default,
    backend: {
      // Get locale data by reading files with fs
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
  });

/**
 * An async function to serve the i18n instance for server components.
 * Should fix issues with i18n being desynchronized between server and client.
 * @param ns - Any additional namespaces to load
 */
export default async function serveTea(
  ns?: string | string[],
): Promise<TFunction> {
  const lng = i18nServer.language;

  const [cookieContent, headerContent] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const locale = getLocale(
    cookieContent.get("locale")?.value,
    headerContent.get("accept-language"),
  );

  if (locale !== lng) {
    await i18nServer.changeLanguage(locale);
  }

  if (ns) {
    await i18nServer.loadNamespaces(ns);
  }

  return i18nServer.t;
}