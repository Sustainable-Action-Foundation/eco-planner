"use client";

import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next.config";
import { useParams } from "next/navigation";

interface I18nProviderProps {
  children: React.ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);
  const params = useParams();
  const lang = params.lang as string;

  useEffect(() => {
    const initI18n = async () => {
      if (lang && i18n.language !== lang) {
        await i18n.changeLanguage(lang);
      }
      setIsI18nInitialized(true);
    };

    initI18n();
  }, [lang]);

  if (!isI18nInitialized) {
    return null; // Or a loading spinner
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}