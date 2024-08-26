'use client';

import formSubmitter from "@/functions/formSubmitter";

export default function Page() {
  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')

    formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
  }

  return <button type="button" onClick={verify}>Verifiera användare</button>
}