import { match } from "@formatjs/intl-localematcher";
import { Locales, uniqueLocales } from "i18n.config";

export function getLocale(
  localeCookie: string | undefined,
  xLocaleHeader: string | null,
  acceptLanguageHeader: string | null,
): Locales {
  let localeContender: string | Locales = Locales.default;

  if (localeCookie) localeContender = localeCookie;
  else if (xLocaleHeader) localeContender = xLocaleHeader;
  else if (acceptLanguageHeader) localeContender = acceptLanguageHeader;
  else {
    console.warn("No locale was found. Defaulting to the default locale.");
  }

  // Sanitize the locale
  const locale = match([localeContender], uniqueLocales, Locales.default) as Locales;

  return locale;
}