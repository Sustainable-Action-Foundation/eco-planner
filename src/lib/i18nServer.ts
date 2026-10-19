import "server-only";
import i18nServer, { type TFunction } from "i18next";
import { initTemplate, Locales, possessive, relativeTime, titleCase } from "@root/i18n.config";
import Backend from "i18next-fs-backend";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/functions/getLocale";
import { patchI18nT } from "@/lib/informativeCimodeT";

await i18nServer.use(Backend)
  .init({
    ...initTemplate(),
    initAsync: true,
    lng: process.env.TEST_ENVIRONMENT === "testing" ? "cimode" : Locales.default,
    backend: {
      // Get locale data by reading files with fs
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
  });

patchI18nT(i18nServer);

if (!i18nServer.services.formatter) {
  console.warn("i18nServer formatter is not available. Custom formatters will not be added.");
}

i18nServer.services.formatter?.add("titleCase", titleCase);
i18nServer.services.formatter?.add("possessive", possessive);
i18nServer.services.formatter?.add("timeAgo", relativeTime);

/**
 * A translator bound to the request's locale, for server components and route handlers.
 * The i18next instance is shared by every request in the process, so its language is never
 * switched here: a switch would leak into whatever else is rendering at the same time (pages
 * that await the database between fetching their translator and using it). The request's
 * locale is loaded into the shared store and fixed into the returned `t` instead.
 * @param ns - Any additional namespaces to load
 */
export default async function serveTea(
  ns?: string | string[],
): Promise<TFunction> {
  const [cookieContent, headerContent] = await Promise.all([
    cookies(),
    headers(),
  ]);
  const locale = getLocale(
    cookieContent.get("locale")?.value,
    headerContent.get("accept-language"),
  );

  // Both loads are idempotent. The language goes first so that a namespace new to this
  // process is loaded for it too (namespaces load for the preloaded languages).
  await i18nServer.loadLanguages(locale);
  if (ns) {
    await i18nServer.loadNamespaces(ns);
  }

  return i18nServer.getFixedT(locale);
}
