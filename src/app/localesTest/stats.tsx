"use client";

import { useEffect, useState } from "react";
import styles from "./localesTest.module.css" with {type: "css"};
import { useTranslation } from "react-i18next";
import { allNamespaces } from "i18n.config.ts";

export function Stats(
  {
    keys,
  }: {
    keys: string[],
  }
) {
  const { t } = useTranslation(allNamespaces);

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
      const serverSide: HTMLElement | null = row.querySelector(`*[data-type="server"]`);
      const clientSide: HTMLElement | null = row.querySelector(`*[data-type="client"]`);

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
    <div>
      <p>{keys.length} keys found</p>
      &middot;
      <p>{emptyCount} resolved to empty</p>
      &middot;
      <p>{missingCount} resolved to missing</p>
    </div>
  );
}