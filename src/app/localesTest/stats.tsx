"use client";

import { useEffect, useState } from "react";
import styles from "./localesTest.module.css" with {type: "css"};
import { useTranslation } from "react-i18next";

export function Stats(
  {
    keys,
  }: {
    keys: string[],
  }
) {
  const { t } = useTranslation();

  const [emptyCount, setEmptyCount] = useState(0);
  const [missingCount, setMissingCount] = useState(0);

  const empty = "[EMPTY]";
  const missing = "[MISSING]";
  const tableId = "translation-table";

  useEffect(() => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll("div");
    let emptyCount = 0;
    let missingCount = 0;

    rows.forEach((row) => {
      const serverSide: HTMLElement | null = row.querySelector(`p[data-type="server"]`);
      const clientSide: HTMLElement | null = row.querySelector(`p[data-type="client"]`);

      // Server side check
      if (serverSide && serverSide.textContent === empty) {
        serverSide.dataset["content"] = "empty";
        emptyCount++;
      }
      else if (serverSide && serverSide.textContent === missing) {
        serverSide.dataset["content"] = "missing";
        missingCount++;
      }
      else if (serverSide) {
        serverSide.dataset["content"] = "";
      }

      // Client side check
      if (clientSide && clientSide.textContent === empty) {
        clientSide.dataset["content"] = "empty";
        emptyCount++;
      }
      else if (clientSide && clientSide.textContent === missing) {
        clientSide.dataset["content"] = "missing";
        missingCount++;
      }
      else if (clientSide) {
        clientSide.dataset["content"] = "";
      }
    });

    setEmptyCount(emptyCount);
    setMissingCount(missingCount);
  }, [keys, emptyCount, missingCount]);

  return (
    <div className={styles.stats}>
      <p>{t("test:keys_found", { count: keys.length })}</p>
      &middot;
      <p>{t("test:empty", { count: emptyCount })}</p>
      &middot;
      <p>{t("test:missing", { count: missingCount })}</p>
    </div>
  );
}