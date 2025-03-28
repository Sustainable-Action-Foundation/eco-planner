"use client";

import { match } from "@formatjs/intl-localematcher";
import { setCookie } from "cookies-next/client";
import { Locales, uniqueLocales } from "i18n.config";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [buttonLocale, setButtonLocale] = useState(i18n.language);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function setLocale(lng: string) {
    // Sanitize locale
    const cleanLocale = match([lng], uniqueLocales, Locales.default);

    // Update local state for rendering of this component
    setButtonLocale(cleanLocale);

    // Set cookie
    setCookie("locale", cleanLocale);

    // Update i18n instance
    await i18n.changeLanguage(cleanLocale);

    // Rerender the page with the new locale
    startTransition(() => {
      router.refresh();
    });

    // Trigger React context updates in client components
    window.dispatchEvent(new CustomEvent("i18n-language-changed"));
  }

  return (<>
    <select
      className={`height-100 width-100 cursor-pointer`}
      onChange={async (e) => await setLocale(e.target.value)}
      value={buttonLocale}
      disabled={isPending}
    >
      {
        uniqueLocales
          // Puts the current locale at the top of the list
          .sort((a, b) => (a === buttonLocale ? -1 : b === buttonLocale ? 1 : 0))
          .map((locale) => (
            <option key={locale} value={locale} className="cursor-pointer">
              {locale}
            </option>
          ))
      }
    </select>
  </>
  );
}