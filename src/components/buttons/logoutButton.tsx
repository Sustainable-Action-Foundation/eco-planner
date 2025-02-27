'use client';

import Image from "next/image";
import parentDict from "./buttons.dict.json" with { type: "json" };
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function LogoutButton() {
  const dict = parentDict.logoutButton;
  // Throws error if data is missing
  const locale = useContext(LocaleContext);

  return (
    <button className="flex align-items-center rounded transparent padding-50 gap-50 width-100 font-weight-500" style={{ fontSize: '1rem', whiteSpace: 'nowrap' }} onClick={async () => {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => {
        if (res.ok) {
          window.location.href = '/'
        } else {
          alert(dict.logoutFailed[locale]);
        }
      })
    }}>
      <Image src="/icons/logout.svg" alt="" width="24" height="24" />
      {dict.logout[locale]}
    </button>
  )
}