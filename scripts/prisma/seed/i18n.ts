// A Swedish `t` for the seed: the recipes it stores name their variables the
// way the app does (the same locale keys the goal form uses), so a seeded copy
// of a national goal reads like one made in the form.

import i18next from "i18next";
import type { TFunction } from "i18next";
import Backend from "i18next-fs-backend";
import path from "node:path";
import { allNamespaces, initTemplate, Locales } from "@root/i18n.config";

export async function seedT(): Promise<TFunction> {
  const instance = i18next.createInstance();
  await instance.use(Backend).init({
    ...initTemplate(),
    initAsync: true,
    lng: Locales.svSE,
    ns: allNamespaces,
    backend: {
      loadPath: path.join(process.cwd(), "public/locales/{{lng}}/{{ns}}.json"),
    },
  });
  return instance.t;
}
