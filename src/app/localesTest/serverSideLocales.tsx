"use server";

import { t } from "@/lib/i18nServer";

export async function ServerLocales({ allKeys, className = "" }: { allKeys: string[], className?: string }) {


  return (<>
    {allKeys.map((key, index) => {
      let translation = t(key, { count: 17, date: new Date(Date.now() - 10000) });
      let textColor = "inherit";
      let fontWeight = "inherit";

      if (translation === "") {
        translation = t("test:empty_string");
        textColor = "red";
        fontWeight = "bold";
      }
      if (translation === key) {
        translation = `${t("test:not_found")} (${key})`;
        textColor = "red";
        fontWeight = "bold";
      }

      return (
        <p
          key={key}
          className={className}
          style={{ gridRow: index + 2, color: textColor, fontWeight }}
        >
          {translation}
        </p>
      );
    })}
  </>);
}