"use server";

import { t } from "@/lib/i18nServer";

export async function ServerLocales({ allKeys }: { allKeys: string[] }) {
  return (<>
    {allKeys.map((key) => (<p key={key}>{t(key, { count: 0, date: Date.now() })}</p>))}
  </>);
}