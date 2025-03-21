"use client";

import { useTranslation } from "react-i18next";

export function ClientLocales({ allKeys }: { allKeys: string[] }) {
  const { t } = useTranslation();

  return (<>
    {allKeys.map((key) => (<p key={key}>{t(key, { count: 0, date: Date.now() })}</p>))}
  </>);
}