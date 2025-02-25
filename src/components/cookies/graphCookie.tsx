"use client"

import { storageConsent, allowStorage, clearStorage } from "@/functions/localStorage";
import { useEffect, useState } from "react";
import dict from "./graphCookie.dict.json" assert { type: "json" };
import { useClientLocale } from "@/functions/clientLocale"

export default function GraphCookie() {
  const locale = useClientLocale();

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
      {dict.allowStorage[locale]}
    </label>
  )
}