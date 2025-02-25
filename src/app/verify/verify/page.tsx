'use client';

import formSubmitter from "@/functions/formSubmitter";
import dict from "./page.dict.json" with { type: "json" };
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function Page() {
  const locale = useContext(LocaleContext);

  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')

    formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
  }

  return <button type="button" onClick={verify}>{dict.verifyUser[locale]}</button>
}