"use client"

import { storageConsent, allowStorage, clearStorage } from "@/functions/localStorage";
import { useContext, useEffect, useState } from "react";
import { createDict } from "./cookies.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function GraphCookie() {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).graphCookie;

  const [storageAllowed, setStorageAllowed] = useState(false)

  useEffect(() => {
    setStorageAllowed(storageConsent())
  }, [])

  return (
    <label className="flex gap-25 align-items-center">
      <input type="checkbox" id="allowStorage" checked={storageAllowed} onChange={e => {
        if (e.target.checked) {
          setStorageAllowed(true);
          allowStorage();
        } else {
          setStorageAllowed(false);
          clearStorage();
        }
      }} />
      {dict.allowStorage}
    </label>
  )
}