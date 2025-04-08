"use client";

import { TOptionsBase } from "i18next";
import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { Trans, useTranslation } from "react-i18next";

export function ClientSideT({ i18nKey, options }: { i18nKey: string, options: TOptionsBase & $Dictionary & { context?: undefined; } }) {
  const { t } = useTranslation();

  const value = t(i18nKey, options);

  // In case of nested html elements, use <Trans />
  if (value.includes("<") && value.includes(">")) {
    return (
      <p>
        <Trans
          i18nKey={i18nKey}
          tOptions={options}
          components={{
            a: <a />,
            p: <p />,
            span: <span />,
            div: <div />,
            small: <small />,
            strong: <strong />,
            italic: <i />,
            i: <i />,
            br: <br />,
            kbd: <kbd />,
            code: <code />,
          }}
        />
      </p>
    );
  }

  return (
    <p>{t(i18nKey, options)}</p>
  );
}