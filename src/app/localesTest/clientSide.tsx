"use client";

import { TOptionsBase } from "i18next";
import { $Dictionary } from "node_modules/i18next/typescript/helpers";
import { Trans, useTranslation } from "react-i18next";
import { reporter } from "./commonLogic";

export function ClientSideT({ i18nKey, options }: { i18nKey: string, options: TOptionsBase & $Dictionary & { context?: undefined; } }) {
  const { t } = useTranslation();

  const value = reporter(i18nKey, t(i18nKey, options));

  // In case of nested html elements, use <Trans />
  if (value.includes("<") && value.includes(">")) {
    return (
      <Trans
        i18nKey={i18nKey}
        tOptions={options}
        components={{
          a: <a href="#" />,
          Link: <a href="#" />,
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
    );
  }

  return value;
}