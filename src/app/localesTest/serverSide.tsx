import "server-only";
import serveTea from "@/lib/i18nServer";
import { reporter } from "./commonLogic";
import type { TOptions } from "@/../i18n.config";
import { allNamespaces } from "@/../i18n.config";

export async function ServerSideT({ i18nKey, options }: { i18nKey: string, options: TOptions, props?: Record<string, unknown> }) {
  const t = await serveTea(allNamespaces);
  const value = reporter(i18nKey, t(i18nKey, options));

  return value;
}