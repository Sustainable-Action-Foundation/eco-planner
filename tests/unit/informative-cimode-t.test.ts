import { expect, test } from "playwright/test";
import { createInstance } from "i18next";
import { Locales } from "../../i18n.config";
import { patchI18nT } from "../../src/lib/informativeCimodeT";

/*
 * The cimode t wrapper appends the parameters a translation used. Whether it does so
 * must follow the language of the call when one is given (a fixed-language t on the
 * shared server instance), and the instance language otherwise.
 */

async function instance(lng: string) {
  const i18n = createInstance();
  await i18n.init({
    lng,
    fallbackLng: Locales.enSE,
    supportedLngs: [Locales.enSE, Locales.svSE],
    defaultNS: false,
    ns: ["pages"],
    interpolation: { escapeValue: false },
    resources: {
      [Locales.enSE]: { pages: { greeting: "Hello {{name}}", plain: "Plain" } },
      [Locales.svSE]: { pages: { greeting: "Hej {{name}}", plain: "Enkel" } },
    },
  });
  patchI18nT(i18n);
  return i18n;
}

test("an instance in cimode expands parameters, a real language does not", async () => {
  const cimode = await instance(Locales.test);
  expect(cimode.t("pages:greeting", { name: "martin" })).toBe('greeting :: {"name":"martin"}');
  expect(cimode.t("pages:plain")).toBe("plain");

  const english = await instance(Locales.enSE);
  expect(english.t("pages:greeting", { name: "martin" })).toBe("Hello martin");
});

test("the language of the call wins over the language of the instance", async () => {
  const cimode = await instance(Locales.test);
  const swedish = cimode.getFixedT(Locales.svSE);
  expect(swedish("pages:greeting", { name: "martin" })).toBe("Hej martin");
  expect(swedish("pages:plain")).toBe("Enkel");

  const english = await instance(Locales.enSE);
  const test = english.getFixedT(Locales.test);
  expect(test("pages:greeting", { name: "martin" })).toBe('greeting :: {"name":"martin"}');
});
