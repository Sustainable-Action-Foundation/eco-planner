"use client";

import { useTranslation } from "react-i18next";

export function ClientLocales({ allKeys, className = "" }: { allKeys: string[], className?: string }) {
  const { t } = useTranslation();

  return (<>
    {allKeys.map((key, index) => {
      let translation = t(key, { count: 17, date: new Date(Date.now() - 10000) });
      let textColor = "inherit";
      let fontWeight = "inherit";

      // Empty resolve, usually formatting error
      if (translation === "") {
        translation = t("test:empty_string");
        textColor = "red";
        fontWeight = "bold";
      }
      // Resolves to key, usually missing translation
      if (translation === key.replace(/.*:/, "") /* The namespace doesn't get included */) {
        translation = `${t("test:not_found")}`;
        textColor = "red";
        fontWeight = "bold";
      }

      return (
        <p
          data-odd={index % 2 === 0}
          data-testid="client-locale"
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