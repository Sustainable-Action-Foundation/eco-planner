import { t } from "@/lib/i18nServer";
import { ClientLocales } from "./clientSide";
import { ServerLocales } from "./serverSide";
import { KeysColumn } from "./keysColumn";
import { ns } from "i18n.config";

export default async function LocaleTestPage() {

  const namespaces = ns;
  const allKeys = await Promise.all(namespaces.map(async (namespace) => {
    const json = await import(`public/locales/en/${namespace}.json`);

    // Resolve nested keys to be [parent].[child]
    const keys = Object.keys(json).map((key) => {
      if (typeof json[key] === "object") {
        return Object.keys(json[key]).map((childKey) => `${key}.${childKey}`);
      }

      return key;
    }).flat();

    // Add namespace to keys
    const nsMappedKeys = keys.map(key => `${namespace}:${key}`);

    // Remove default keys which are dupes of every root key
    const noDefaultKeys = nsMappedKeys.filter(key => !key.includes(":default."));

    return noDefaultKeys;
  })).then((keys) => keys.flat());

  return (
    <div>
      <h1>{t("test:title")}</h1>
      <p>
        {t("test:description")}
      </p>

      <p><small>{t("test:keys_found", { count: allKeys.length })}</small></p>

      <div id="locales-table">
        <div>
          <h3>{t("test:server_side")}</h3>
          <ServerLocales allKeys={allKeys} />
        </div>

        <hr />

        <div>
          <h3>{t("test:keys")}</h3>
          <KeysColumn allKeys={allKeys} />
        </div>

        <hr />

        <div>
          <h3>{t("test:client_side")}</h3>
          <ClientLocales allKeys={allKeys} />
        </div>
      </div>

      <style>{`
        #locales-table {
          display: grid;
          grid-template-columns: 3fr 1px max-content 1px 3fr;
          gap: 1rem;
          margin-right: 2rem;

          &>div {
            &>h3 {
              margin: 0;
            }

            &>p {
              margin: 0;
            }
          }
        }
      `}</style>
    </div>
  )
}