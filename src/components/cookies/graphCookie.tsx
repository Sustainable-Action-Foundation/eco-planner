"use client"

import { storageConsent, allowStorage, clearStorage } from "@/functions/localStorage";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function GraphCookie({
  id,
  className,
  style,
}: {
  id?: string,
  className?: string,
  style?: React.CSSProperties,
}) {
  const { t } = useTranslation("graphs");

  const [storageAllowed, setStorageAllowed] = useState(false)

  useEffect(() => {
    setStorageAllowed(storageConsent())
  }, [])

  return (
    <label 
      id={id || undefined} 
      className={`${className ? className + ' ' : ''} flex gap-25 align-items-center`} 
      style={style}
    >
      <input type="checkbox" id="allowStorage" checked={storageAllowed} onChange={e => {
        if (e.target.checked) {
          setStorageAllowed(true);
          allowStorage();
        } else {
          setStorageAllowed(false);
          clearStorage();
        }
      }} />
      {t("graphs:graph_cookie.save_preferences")}
    </label>
  )
}