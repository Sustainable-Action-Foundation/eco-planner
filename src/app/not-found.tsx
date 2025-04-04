"use client";

import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();

  return (<>
    <h1>{t("common:404.status")}</h1>
    <h2>{t("common:404.title")}</h2>
    <p>{t("common:404.description")}</p>
  </>);
}