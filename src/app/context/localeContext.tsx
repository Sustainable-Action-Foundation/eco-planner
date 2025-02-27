'use client';

import { createContext, useState } from 'react';
import { Locale } from '@/types';

export const LocaleContext = createContext<Locale>(Locale.default);
export const LocaleSetterContext = createContext<React.Dispatch<React.SetStateAction<Locale>> | null>(null);

export default function LocaleProvider({
  serverLocale,
  children
}: {
  serverLocale: Locale,
  children?: React.ReactNode
}) {
  const [locale, setLocale] = useState<Locale>(Object.values(Locale).includes(serverLocale) ? serverLocale : Locale.default);

  return (
    <LocaleContext.Provider value={locale}>
      <LocaleSetterContext.Provider value={setLocale}>
        {children}
      </LocaleSetterContext.Provider>
    </LocaleContext.Provider>
  );
}