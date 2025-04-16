import styles from "./localesTest.module.css" with {type: "css"};
import { t } from "@/lib/i18nServer";
import { uniqueLocales, ns as namespaces, Locales } from "i18n.config";
import fs from "node:fs";
import path from "node:path";
import { ServerSideT } from "./serverSide";
import { ClientSideT } from "./clientSide";
import { Stats } from "./stats";

export default async function LocaleTestPage() {
  // In dev mode i18next can be kinda flakey so this just boots the server side i18n instance
  const _preloadT = t("common:action_one")

  const defaultArgs = { count: 17, date: new Date(Date.now() - 10000) };

  const allFlattened = getAllJSONFlattened()[Locales.default];
  const allKeys = Object.keys(allFlattened);

  const entriesWithFormatters = Object.entries(allFlattened)
    .filter(([, value]) => value.match(/\{\{[^{}]*?,[^{}]*?\}\}/))
    .flatMap(([key, value]) => {
      const matches = Array.from(value.matchAll(/\{\{([^{}]*?),([^{}]*?)\}\}/g));
      const formatters = matches.map(match => ([key, match]));
      return formatters;
    });

  return (
    <div>
      {/* Override side padding to fit table to full width */}
      <style>{`aside~div {padding:0 !important;}`}</style>

      {/* Description */}
      <section className={styles.description}>
        <h1>Test page for translations</h1>
        <p>Here you can see all translation keys in the project to easily see if something is missing or wrong. All keys will receive the arguments {JSON.stringify(defaultArgs)} to make debugging easier. In addition to that, if a key resolves to an empty string, it will be displayed as &quot;[EMPTY]&quot; and if the key cannot be resolved, it will be displayed as &quot;[MISSING]&quot;.</p>
      </section>

      {/* Tables */}
      <section className={styles.tables}>
        {/* Formatters */}
        <div className={styles.formatters}>
          <h2>Formatters</h2>
          <table>
            {/* Header */}
            <thead>
              <tr>
                <th>{/* Spacing */}</th>
                <th>Formatters</th>
                <th>Input</th>
                <th>{/* Arrow */}</th>
                <th>Output</th>
                <th>Key</th>
              </tr>
            </thead>
            {/* Body */}
            <tbody>
              {entriesWithFormatters
                .sort(([, a], [, b]) => {
                  const [, , aType] = a;
                  const [, , bType] = b;

                  // Alphabetical sort
                  if (aType < bType) return -1;
                  if (aType > bType) return 1;
                  return 0;
                })
                .map(([key, interpolationCall], index) => {
                  const [formattedInput, formatterVar, formatterType] = interpolationCall;

                  const formattedOutput = t(formattedInput);
                  const isEmpty = formattedOutput == "";
                  const isMissing = formattedOutput == formattedInput;
                  const output = isEmpty ? "[EMPTY]" : isMissing ? "[MISSING]" : formattedOutput;

                  return (
                    <tr key={index} className={`${index % 2 === 0 ? styles.even : styles.odd}`}>
                      <td>{index + 1}</td>
                      <td>{formatterType}</td>
                      <td>{formattedInput}</td>
                      <td>{"→"}</td>
                      <td data-content={isEmpty ? "empty" : isMissing ? "missing" : ""}>{output}</td>
                      <td>{key}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <h2>Stats about all translations</h2>
          {/* Stats is client side to count empty and missing results */}
          <Stats keys={allKeys} />
          {/* All translations */}
        </div>

        {/* All translations */}
        <div className={styles.allTranslations}>
          <h2>All Translations</h2>
          <table data-testid="translation-table">
            {/* Header */}
            <thead>
              <tr>
                <th>{/* Spacing */}</th>
                <th>Key</th>
                <th>Server Side</th>
                <th>Client Side</th>
              </tr>
            </thead>
            {/* Body */}
            <tbody>
              {allKeys.map((key, index) => {
                return (
                  <tr key={index} className={`${index % 2 === 0 ? styles.even : styles.odd}`}>
                    <td>{index + 1}</td>
                    <td data-testid="key" data-type="key">{key}</td>
                    <td data-testid="server" data-type="server"><ServerSideT i18nKey={key} options={defaultArgs} /></td>
                    <td data-testid="client" data-type="client"><ClientSideT i18nKey={key} options={defaultArgs} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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