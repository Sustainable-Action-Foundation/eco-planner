import { t } from "@/lib/i18nServer";
import { ClientLocales } from "./clientSideLocales";
import { ServerLocales } from "./serverSideLocales";
import { KeysColumn } from "./keysColumn";
import { ns } from "i18n.config";
import { CounterScript } from "./missingKeysCounter";

type LocaleJSON = NestedLocaleJSON | string;
interface NestedLocaleJSON {
  [key: string]: NestedLocaleJSON | string;
}

export default async function LocaleTestPage() {

  const namespaces = ns;
  const allKeys = await Promise.all(namespaces.map(async (namespace) => {
    const json = await import(`public/locales/en-SE/${namespace}.json`);

    // Resolve all nested keys to [parent1].[..parentN].[key]
    const extractNestedKeys = (obj: LocaleJSON | null, prefix = ""): string[] => {
      // If leaf node, return key
      if (typeof obj !== "object" || obj === null) {
        return [prefix];
      }

      // Else, recurse into children
      return Object.keys(obj).flatMap(key => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        return extractNestedKeys(obj[key], newPrefix);
      });
    };

    // Extract all keys with their full paths
    const keys = extractNestedKeys(json);

    // Add namespace to keys
    const nsMappedKeys = keys.map(key => `${namespace}:${key}`);

    // Remove default keys which are dupes of every root key
    const noDefaultKeys = nsMappedKeys.filter(key => !key.includes(":default."));

    return noDefaultKeys;
  })).then((keys) => keys.flat());

  const rowCount = allKeys.length + 1;

  return (
    <div>
      <h1>{t("test:title")}</h1>
      <p>{t("test:description", { args: "{ count: 17, date: new Date(Date.now() - 10000) }" })}</p>

      <div className="flex flex-inline">
        {/* Key count */}
        <p data-testid="key-counter"><small>{t("test:keys_found", { count: allKeys.length })}</small></p>
        {/* Server NOT FOUND and EMPTY STRING */}
        <p data-testid="server-counter"><small></small></p>
        {/* Client NOT FOUND and EMPTY STRING */}
        <p data-testid="client-counter"><small></small></p>
      </div>

      <div id="locales-table">
        <h3 className="col-1 row-1">{t("test:keys")}</h3>
        <KeysColumn className="col-1 break" allKeys={allKeys} />

        <hr className="col-2" style={{ gridRow: `span ${rowCount}` }} />

        <h3 className="col-3 row-1 ">{t("test:server_side")}</h3>
        <ServerLocales className="col-3" allKeys={allKeys} />

        <hr className="col-4" style={{ gridRow: `span ${rowCount}` }} />

        <h3 className="col-5 row-1">{t("test:client_side")}</h3>
        <ClientLocales className="col-5" allKeys={allKeys} />
      </div>

      <style>{`
        .col-1 {
          grid-column: 1;
        }
        .col-2 {
          grid-column: 2;
        }
        .col-3 {
          grid-column: 3;
        }
        .col-4 {
          grid-column: 4;
        }
        .col-5 {
          grid-column: 5;
        }

        .row-1 {
          grid-row: 1;
        }

        .break {
          line-break: anywhere;
        }

        #locales-table {
          display: grid;
          grid-template-columns: 1fr 1px 1fr 1px 1fr;
          grid-template-rows: ${rowCount + 1}fr;
          margin-bottom: 10rem;

          &>p,
          &>h3 {
            margin: 0;
            padding: 0.2rem 1ch;
          }

          &>hr {
            opacity: 0.5;
          }

          &>p[data-odd="true"] {
            background-color: #f1f1f1;
          }
        }
      `}</style>

      <CounterScript
        notFoundText={t("test:not_found")}
        emptyStringText={t("test:empty_string")}
      />
    </div>
  );
}