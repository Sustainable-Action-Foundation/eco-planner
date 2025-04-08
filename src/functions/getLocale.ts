import { match } from "@formatjs/intl-localematcher";
import { Locales, uniqueLocales } from "i18n.config";
import acceptLanguage from "accept-language";

acceptLanguage.languages(uniqueLocales);

export function getLocale(
  localeCookie: string | undefined,
  acceptLanguageHeader: string | null,
  overrideLng: string | undefined = undefined,
): Locales {
  let localeContender: string | Locales = Locales.default;

  if (overrideLng) localeContender = overrideLng;
  else if (localeCookie) localeContender = localeCookie;
  else if (acceptLanguageHeader) localeContender = acceptLanguage.get(acceptLanguageHeader) ?? Locales.default;
  else {
    // TODO: remove. In some cases, which i cannot reproduce, this is thrown but I don't know why.
    console.debug(new Error().stack);
    console.warn("No locale was found. Defaulting to the default locale.");
  }

  // Sanitize the locale
  const locale = match([localeContender], uniqueLocales, Locales.default) as Locales;

  return locale;
}