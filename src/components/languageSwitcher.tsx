"use client";

import { match } from "@formatjs/intl-localematcher";
import { setCookie } from "cookies-next/client";
import { Locales, uniqueLocales } from "i18n.config";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState(i18n.language);

  async function setLocale(lang: string) {
    // Sanitize locale
    const newLocale = match([lang], uniqueLocales, Locales.default);

    // Update i18n instance
    await i18n.changeLanguage(newLocale);

    // Update the locale cookie (to sync with server-side)
    setCookie("locale", newLocale);

    // Update local state for rendering of this component
    setCurrentLocale(newLocale);

    // Rerender the page with the new locale
    startTransition(() => {
      router.refresh();
    });

    // Trigger React context updates in client components
    window.dispatchEvent(new CustomEvent("i18n-language-changed"));
  }

  return (
    <select
      className={`height-100 width-100 cursor-pointer`}
      onChange={async (e) => await setLocale(e.target.value)}
      value={currentLocale}
      disabled={isPending}
    >
      {
        uniqueLocales
          // Puts the current locale at the top of the list
          .sort((a, b) => (a === currentLocale ? -1 : b === currentLocale ? 1 : 0))
          .map((locale) => (
            <option key={locale} value={locale} className="cursor-pointer">
              {locale}
            </option>
          ))
      }
    </select>
  );
}