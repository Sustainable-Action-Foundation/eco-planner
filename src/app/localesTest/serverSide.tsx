import "server-only";
import serveTea from "@/lib/i18nServer";
import { TOptions } from "i18next";
import { reporter } from "./commonLogic";
import { allNamespaces } from "i18n.config.ts";

export async function ServerSideT({ i18nKey, options, ...props }: { i18nKey: string, options: TOptions, props?: Record<string, unknown> }) {
  const t = await serveTea(allNamespaces);
  const value = reporter(i18nKey, t(i18nKey, options));

  return value;
}