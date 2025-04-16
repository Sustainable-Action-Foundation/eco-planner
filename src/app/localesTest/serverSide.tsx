"use server";

import { t } from "@/lib/i18nServer";
import { TOptions } from "i18next";
import { reporter } from "./commonLogic";

export async function ServerSideT({ i18nKey, options }: { i18nKey: string, options: TOptions }) {
  const value = reporter(i18nKey, t(i18nKey, options));

  return value;
}