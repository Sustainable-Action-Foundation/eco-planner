'use client';

import verifyUser from "@/functions/verifyUser"

export default function Page() {
  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')
    verifyUser(email ?? "", hash ?? "").then(() => {
      alert('Användaren är verifierad, du kommer nu omdirigeras till inloggningssidan för att logga in.')
      window.location.href = '/login'
    }).catch((e) => {
      alert('Kunde inte verifiera användaren')
    })
  }

  return <button type="button" onClick={verify}>Verifiera användare</button>
}