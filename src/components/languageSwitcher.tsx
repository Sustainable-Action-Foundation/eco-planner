"use client";

import { match } from "@formatjs/intl-localematcher";
import { setCookie } from "cookies-next/client";
import { Locales, uniqueLocales } from "i18n.config";
import i18next from "i18next";

export function LanguageSwitcher() {
  const locale = i18next.language;

  return (
    <select className={`height-100 width-100`}
      onChange={(e) => {
        const newLocale = match(uniqueLocales, [e.target.value], Locales.default);
        setCookie("locale", newLocale);
        i18next.changeLanguage(newLocale);
      }}
    >
      {uniqueLocales
        .sort((a, b) => (a === locale ? -1 : b === locale ? 1 : 0)) // Put the active language on top
        .map((locale) => (
          <option key={locale} value={locale}>
            {locale}
          </option>
        ))}
    </select>
  );
}