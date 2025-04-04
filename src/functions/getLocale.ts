import { match } from "@formatjs/intl-localematcher";
import { Locales, uniqueLocales } from "i18n.config";
import acceptLanguage from "accept-language";

acceptLanguage.languages(uniqueLocales);

export function getLocale(
  localeCookie: string | undefined,
  acceptLanguageHeader: string | null,
): Locales {
  let localeContender: string | Locales = Locales.default;

  if (localeCookie) localeContender = localeCookie;
  else if (acceptLanguageHeader) localeContender = acceptLanguage.get(acceptLanguageHeader) ?? Locales.default;
  else {
    console.warn("No locale was found. Defaulting to the default locale.");
  }

  // Sanitize the locale
  const locale = match([localeContender], uniqueLocales, Locales.default) as Locales;

  return locale;
}