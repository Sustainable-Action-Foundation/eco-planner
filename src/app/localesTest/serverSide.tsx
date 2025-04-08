"use server";

import { t } from "@/lib/i18nServer";
import { TOptions } from "i18next";

export async function ServerSideT({ i18nKey, options }: { i18nKey: string, options: TOptions }) {
  return (
    <p>{t(i18nKey, options)}</p>
  );
}