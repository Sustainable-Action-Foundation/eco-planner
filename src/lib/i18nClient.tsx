"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18nClientInit";
import { getCookie } from "cookies-next";

export default function I18nProvider(
  { children }: { children: React.ReactNode }
) {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);

  useEffect(() => {
    const initI18n = async () => {
      const cookieLang = await getCookie("locale");

      // Try to read cookie lang (locale)
      if (cookieLang && i18n.language !== cookieLang) {
        await i18n.changeLanguage(cookieLang);
        return setIsI18nInitialized(true);
      }

      return setIsI18nInitialized(true);
    };

    initI18n();
  }, []);

  if (!isI18nInitialized) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}