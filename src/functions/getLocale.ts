import { match } from "@formatjs/intl-localematcher";
import { Locales, uniqueLocales } from "i18n.config";
import acceptLanguage from "accept-language";

acceptLanguage.languages(uniqueLocales);

export function getLocale(
  localeCookie: string | undefined,
  acceptLanguageHeader: string | null,
  overrideLng: string | undefined = undefined,
): Locales {
  let localeContender: string = Locales.default;

  if (overrideLng) localeContender = overrideLng;
  else if (localeCookie) localeContender = localeCookie;
  else if (acceptLanguageHeader) localeContender = acceptLanguage.get(acceptLanguageHeader) ?? Locales.default;
  else {
    // Note: When running tests with playwright, this will be thrown one tests without a defined browser environment since the server tries to translate in the prerendering phase.
    console.warn(`No user locale found. Using default locale (${Locales.default}). If this is is a browserless test, ignore this.`);
  }

  // Sanitize the locale
  const locale = match([localeContender], uniqueLocales, Locales.default) as Locales;

  return locale;
}