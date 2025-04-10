import styles from "./localesTest.module.css" with {type: "css"};
import { t } from "@/lib/i18nServer";
import { uniqueLocales, ns as namespaces, Locales } from "i18n.config";
import fs from "node:fs";
import path from "node:path";
import { ServerSideT } from "./serverSide";
import { ClientSideT } from "./clientSide";
import { Stats } from "./stats";

export default async function LocaleTestPage() {
  const defaultArgs = { count: 17, date: new Date(Date.now() - 10000) };

  const allFlattened = getAllJSONFlattened()[Locales.default];
  const allKeys = Object.keys(allFlattened);

  return (
    <div>
      {/* Override side padding to fit table to full width */}
      <style>{`aside~div {padding:0 !important;}`}</style>

      {/* Description */}
      <section className={styles.description}>
        <h1>{t("test:title")}</h1>
        <p>{t("test:description", { args: JSON.stringify(defaultArgs) })}</p>

        {/* Stats is client side to count empty and missing results */}
        <Stats keys={allKeys} />
      </section>

      {/* Table */}
      <section data-testid="translation-table" className={styles.table} id="translation-table">
        {/* Header */}
        <div className={styles.header}>
          <span>{/* For consistent spacing */}</span>
          <h2>{t("test:keys", { keyLng: Locales.default })}</h2>
          <h2>{t("test:server_side")}</h2>
          <h2>{t("test:client_side")}</h2>
        </div>
        {/* Body */}
        {allKeys.map((key, index) => {
          return (
            <div key={index} className={`${index % 2 === 0 ? styles.even : styles.odd}`}>
              <span>{index + 1}</span>
              <p data-testid="key" data-type="key">{key}</p>
              <hr />
              <ServerSideT data-testid="server" data-type="server" i18nKey={key} options={defaultArgs} />
              <hr />
              <ClientSideT data-testid="client" data-type="client" i18nKey={key} options={defaultArgs} />
            </div>
          );
        })}
      </section>
    </div>
  );
}

function getAllJSONFlattened(): Record<string, Record<string, string>> {
  const perLocale: Record<string, Record<string, string>> = Object.fromEntries(uniqueLocales.map(locale => [locale, {}]));

  const allPermutations = uniqueLocales.flatMap(locale => namespaces.map(namespace => [locale, namespace]));

  allPermutations.map(([locale, namespace]) => {
    const nsData = JSON.parse(fs.readFileSync(path.join("public/locales", locale, `${namespace}.json`), "utf-8"));
    const flattened = flattenTree(nsData);
    const prefixed = Object.fromEntries(Object.entries(flattened)
      .map(([key, value]) => [`${namespace}:${key}`, value])
    );
    perLocale[locale] = { ...perLocale[locale], ...prefixed };
  })
  return perLocale;
}
function flattenTree(obj: object) {
  const result: Record<string, string> = {};

  const recurse = (obj: object, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object") {
        recurse(value, newPrefix);
      }
      else {
        result[newPrefix] = value;
      }
    }
  };

  recurse(obj);

  return result;
}