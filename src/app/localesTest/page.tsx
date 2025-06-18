import styles from "./localesTest.module.css" with {type: "css"};
import serveTea from "@/lib/i18nServer";
import { uniqueLocales, Locales, allNamespaces } from "i18n.config";
import fs from "node:fs";
import path from "node:path";
import { ServerSideT } from "./serverSide";
import { ClientSideT } from "./clientSide";
import { Stats } from "./stats";

export default async function LocaleTestPage() {
  const t = await serveTea("test");
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
        <p>
          Here you can see all translation keys in the project to easily see if something is missing or wrong. All keys will receive the arguments:
          <strong style={{ whiteSpace: "preserve" }}>{JSON.stringify(defaultArgs, null, 2)}</strong>
          <br />
          to make debugging easier. In addition to that, if a key resolves to an empty string, it will be displayed as <span data-content="empty">[EMPTY]</span> and if the key cannot be resolved, it will be displayed as <span data-content="missing">[MISSING]</span>.
        </p>
      </section>

      {/* Tables */}
      <section className={styles.tables}>
        {/* Formatters */}
        <div>
          <h2>Formatters</h2>
          <div>
            <p>
              This table shows every instance of a <a href="https://www.i18next.com/translation-function/formatting" target="_blank" rel="noopener noreferrer">formatter</a> being used in the app.
            </p>
            <p>
              Definition: formatter statement = &quot;{"{{"}variable, formatters{"}}"}&quot;
            </p>
            <p>
              Input is the variable, resolved trough t(), in case of it being a nested key.
            </p>
            <p>
              Output is the entire formatter statement resolved through t().
            </p>
            <p>
              The mark afterward (✔ or ❌) indicates if the input was transformed in any way by the formatter. If not, that is concerning.
            </p>
          </div>

          <table data-testid="formatter-table">
            {/* Header */}
            <thead>
              <tr>
                <th>{/* Spacing */}</th>
                <th>Formatter</th>
                <th>Input</th>
                <th>{/* Arrow */}</th>
                <th>Output</th>
                <th>{/* Did it change? */}</th>
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

                  const formattedOutput = t(formattedInput, defaultArgs);
                  const isEmpty = formattedOutput == "";
                  const isMissing = formattedOutput == formattedInput;
                  const output = isEmpty ? "[EMPTY]" : isMissing ? "[MISSING]" : formattedOutput;

                  const resolvedVar = t(formatterVar, defaultArgs);

                  return (
                    <tr data-testid="formatter-row" key={index} className={`${index % 2 === 0 ? styles.even : styles.odd}`}>
                      <td>{index + 1}</td>
                      <td>{formatterType}</td>
                      <td data-testid="input">{resolvedVar}</td>
                      <td>{"→"}</td>
                      <td data-testid="output" data-content={isEmpty ? "empty" : isMissing ? "missing" : ""}>{output}</td>
                      <td>{resolvedVar === output ? "❌" : "✔"}</td>
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
        <div>
          <h2>All Translations</h2>
          <div>
            <p>The server side translations simply call the i18nServer t() function. The client side translations either use t() defined with useTranslation() or {`<Trans i18nKey="common:tsx.close" />`} in cases where the translation has any elements in it.</p>
          </div>
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
                  <tr data-testid="translation-row" key={index} className={`${index % 2 === 0 ? styles.even : styles.odd}`}>
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

  const allPermutations = uniqueLocales.flatMap(locale => allNamespaces.map(namespace => [locale, namespace]));

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