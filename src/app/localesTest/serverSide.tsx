"use server";

import { t } from "@/lib/i18nServer";
import { TOptions } from "i18next";
import { reporter } from "./commonLogic";

export async function ServerSideT({ i18nKey, options, ...props }: { i18nKey: string, options: TOptions, props?: Record<string, unknown> }) {
  const value = reporter(i18nKey, t(i18nKey, options));

  return (
    <p {...props}>{value}</p>
  );
}