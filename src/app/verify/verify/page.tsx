'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useClientLocale } from "@/functions/clientLocale";
import dict from "./page.dict.json" assert { type: "json" };

export default function Page() {
  const locale = useClientLocale();

  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')

    formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
  }

  return <button type="button" onClick={verify}>{dict.verifyUser[locale]}</button>
}