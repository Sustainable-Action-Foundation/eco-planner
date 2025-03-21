import { t } from "@/lib/i18nServer";
import { ClientLocales } from "./clientSideLocales";
import { ServerLocales } from "./serverSideLocales";
import { KeysColumn } from "./keysColumn";
import { ns } from "i18n.config";

type LocaleJSON = NestedLocaleJSON | string;
interface NestedLocaleJSON {
  [key: string]: NestedLocaleJSON | string;
}

export default async function LocaleTestPage() {

  const namespaces = ns;
  const allKeys = await Promise.all(namespaces.map(async (namespace) => {
    const json = await import(`public/locales/en/${namespace}.json`);

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

  const rowCount = allKeys.length;

  return (
    <div>
      <h1>{t("test:title")}</h1>
      <p>{t("test:description", { args: "{ count: 17, date: new Date(Date.now() - 10000) }" })}</p>

      <p><small>{t("test:keys_found", { count: allKeys.length })}</small></p>

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

          &>p,
          &>h3 {
            margin: 0;
            padding: 0.2rem 1ch;
          }

          &>hr {
            opacity: 0.5;
          }

          &>p:nth-child(even) {
            background-color: #f1f1f1;
          }
        }
      `}</style>
    </div>
  );
}