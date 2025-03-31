"use client";

import { LocaleContext, LocaleSetterContext } from "@/lib/i18nClient";
import { match } from "@formatjs/intl-localematcher";
import { setCookie } from "cookies-next/client";
import { localeAliases, Locales, uniqueLocales } from "i18n.config";
import { useRouter } from "next/navigation";
import { useContext, useState, useTransition } from "react";

export function LanguageSwitcher() {
  const router = useRouter();
  const locale = useContext(LocaleContext);
  const setLocaleContext = useContext(LocaleSetterContext);
  const [isPending, startTransition] = useTransition();
  const [buttonLocale, setButtonLocale] = useState<Locales>(locale);

  async function setLocale(lng: string) {
    // Sanitize locale
    const cleanLocale = match([lng], uniqueLocales, Locales.default) as Locales;

    // Update local state for rendering of this component
    setButtonLocale(cleanLocale);

    // Set cookie for future visits
    setCookie("locale", cleanLocale);

    // Server update. Refresh the page
    startTransition(() => {
      router.refresh();
    });

    // Client update. Set lang and dispatch event for rerendering
    setLocaleContext(cleanLocale);
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
              {localeAliases[locale]}
            </option>
          ))
      }
    </select>
  </>
  );
}