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
      <ul className="margin-0 padding-0" style={{ listStyle: 'none' }} data-testid="language-switcher-options">
        {uniqueLocales
          .sort((a, b) => localeAliases[a].localeCompare(localeAliases[b]))
          .map((locale) => (
            <li key={locale} className="margin-top-25">
              <button
                key={locale}
                onClick={async () => await setLocale(locale)}
                disabled={isPending}
                style={{ fontSize: '14px' }}
                className={`flex transparent justify-content-space-between align-items-center width-100 padding-25`}
                data-testid={`language-switcher-option-${localeAliases[locale]}`}
                data-checked={locale === buttonLocale}
              >
                {localeAliases[locale]}
                <div
                  className="flex align-items-center justify-content-center"
                  style={{ width: '14px', height: '14px', border: locale === buttonLocale ? '1px solid var(--blue-30)' : '1px solid black', borderRadius: '9999px' }}
                >
                  {locale === buttonLocale ?
                    <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: 'var(--blue-30)' }}></div>
                    : null}
                </div>
              </button>
            </li>
          ))}
      </ul>
    </>

  );
}