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
    const newLocale = match(uniqueLocales, [lang], Locales.default);

    // Update locale in cookie and make sure it's visible to both client and server
    setCookie("locale", newLocale);
    // Change language through i18n instance from useTranslation
    await i18n.changeLanguage(newLocale);
    // Update local state
    setCurrentLocale(newLocale);
    
    // Force a stronger refresh of server components
    startTransition(() => {
      // This combination forces both client and server to re-evaluate
      router.refresh();
      
      // Trigger React context updates in client components
      window.dispatchEvent(new CustomEvent('i18n-language-changed'));
      
      // Update the HTML lang attribute
      document.documentElement.lang = newLocale;
    });
  }

  return (
    <select
      className={`height-100 width-100`}
      onChange={async (e) => await setLocale(e.target.value)}
      value={currentLocale}
      disabled={isPending}
    >
      {
        uniqueLocales
          .sort((a, b) => (a === currentLocale ? -1 : b === currentLocale ? 1 : 0))
          .map((locale) => (
            <option key={locale} value={locale}>
              {locale}
            </option>
          ))
      }
    </select>
  );
}