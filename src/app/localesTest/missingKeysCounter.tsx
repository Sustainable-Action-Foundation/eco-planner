"use client";

import { t } from "i18next";
import { useEffect } from "react";

export function CounterScript({ notFoundText, emptyStringText }: { 
  notFoundText: string,
  emptyStringText: string 
}) {
  useEffect(() => {
    // Server counter
    const serverCounter = document.querySelector("*[data-testid='server-counter']>small");
    const allServerSide = document.querySelectorAll("p[data-testid='server-locale']");
    const notFoundServerSide = Array.from(allServerSide).filter((el) => el.textContent === notFoundText);
    const emptyStringServerSide = Array.from(allServerSide).filter((el) => el.textContent === emptyStringText);
    
    if (serverCounter) {
      // Subtract 1 to account for the translation key itself and clamp to 0
      const notFound = Math.max(notFoundServerSide.length - 1, 0);
      const emptyString = Math.max(emptyStringServerSide.length - 1, 0);
      serverCounter.innerHTML = `${t("test:server")} <span style="color:red;">${t("test:not_found")}</span>=${notFound}, <span style="color:red;">${t("test:empty_string")}</span>=${emptyString}`;
    }

    // Client counter
    const clientCounter = document.querySelector("*[data-testid='client-counter']>small");
    const allClientSide = document.querySelectorAll("p[data-testid='client-locale']");
    const notFoundClientSide = Array.from(allClientSide).filter((el) => el.textContent === notFoundText);
    const emptyStringClientSide = Array.from(allClientSide).filter((el) => el.textContent === emptyStringText);
    
    if (clientCounter) {
      // Subtract 1 to account for the translation key itself and clamp to 0
      const notFound = Math.max(notFoundClientSide.length - 1, 0);
      const emptyString = Math.max(emptyStringClientSide.length - 1, 0);
      clientCounter.innerHTML = `${t("test:client")} <span style="color:red;">${t("test:not_found")}</span>=${notFound}, <span style="color:red;">${t("test:empty_string")}</span>=${emptyString}`;
    }
  }, [notFoundText, emptyStringText]);
  
  return null;
}