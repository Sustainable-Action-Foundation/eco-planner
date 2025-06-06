"use client";

import { useTranslation } from "react-i18next";

//TODO METADATA: Add metadata
export default function NotFound() {
  const { t } = useTranslation("common");

  return (<>
    <div className="container-text margin-inline-auto padding-block-500">
      <h1 className="text-align-center margin-top-500 padding-top-300" style={{ fontSize: '5rem' }}>{t("common:404.status")}</h1>
      <h2 className="text-align-center margin-bottom-0">{t("common:404.title")}</h2>
      <p className="text-align-center margin-top-0">{t("common:404.description")}</p>
    </div>
  </>);
}