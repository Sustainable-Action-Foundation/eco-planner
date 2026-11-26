"use client";

import { reportPrintParam } from "@/functions/orgReport";
import { IconPrinter } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Opens the browser's print dialog, where the report is saved as a PDF. Arriving with
 * `?print=true` (the landing's export button) opens it once the page has loaded; the
 * param is then dropped from the address, so reloading or coming back doesn't print again.
 */
export default function PrintButton() {
  const { t } = useTranslation("pages");

  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(reportPrintParam) !== "true") return;
    // Dropped before anything else, so a second run of this effect (strict mode, a re-shown route) finds nothing to do
    url.searchParams.delete(reportPrintParam);
    window.history.replaceState(window.history.state, "", url);

    // Everything the document draws is in the server's response; only images (the banner) and fonts load after it
    const loaded = document.readyState === "complete"
      ? Promise.resolve()
      : new Promise<void>(resolve => window.addEventListener("load", () => resolve(), { once: true }));
    void Promise.all([loaded, document.fonts.ready]).then(() => {
      // Not if the visitor has left the report meanwhile (the route may stay mounted, hidden)
      if (button.current?.isConnected && button.current.offsetParent !== null) window.print();
    });
  }, []);

  return (
    <button
      ref={button}
      type="button"
      className="seagreen color-purewhite round font-weight-500 flex gap-50 align-items-center"
      onClick={() => window.print()}
      data-testid="org-report-print"
    >
      <IconPrinter width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
      {t("pages:org_report.toolbar.print")}
    </button>
  );
}
