"use client";

import { LocaleContext, LocaleSetterContext } from "@/lib/i18nClient";
import { match } from "@formatjs/intl-localematcher";
import { setCookie } from "cookies-next/client";
import { localeAliases, Locales, uniqueLocales } from "i18n.config";
import { useContext, useState, useTransition } from "react";

export function LanguageSwitcher() {
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
    // TODO: Find a better solution than hard refresh
    startTransition(() => {
      window.location.reload();
    });

    // Client update. Set lang and dispatch event for rerendering
    setLocaleContext(cleanLocale);
    window.dispatchEvent(new CustomEvent("i18n-language-changed"));
  }

  return (
    <>
      <ul className="margin-0 padding-0" style={{listStyle: 'none'}}>
        {uniqueLocales
          .sort((a, b) => localeAliases[a].localeCompare(localeAliases[b]))
          .map((locale) => (
            <li key={locale} className="margin-block-25">
              <button
                key={locale}
                onClick={async () => await setLocale(locale)}
                disabled={isPending}
                style={{fontSize: '.8rem'}}
                className={`width-100 padding-25 ${locale === buttonLocale ? 'blue-30 color-purewhite' : 'gray-90'}`}
                
              >
                {localeAliases[locale]}
              </button>
            </li>
          ))}
      </ul>
    </>

  );
}