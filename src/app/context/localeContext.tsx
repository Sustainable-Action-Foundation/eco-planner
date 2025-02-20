'use client';

import { createContext, useState } from 'react';
import { Locale } from '@/types';
import { DEFAULT_LOCALE, LOCALES } from '@/constants.ts';

export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
export const LocaleSetterContext = createContext<React.Dispatch<React.SetStateAction<Locale>> | null>(null);

export default function LocaleProvider({
  serverLocale,
  children
}: {
  serverLocale: Locale,
  children?: React.ReactNode
}) {
  const [locale, setLocale] = useState<Locale>(LOCALES.includes(serverLocale) ? serverLocale : DEFAULT_LOCALE);

  return (
    <LocaleContext.Provider value={locale}>
      <LocaleSetterContext.Provider value={setLocale}>
        {children}
      </LocaleSetterContext.Provider>
    </LocaleContext.Provider>
  );
}