'use client';

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  return (
    <div>
      <p>Ett email ska ha skickats till din emailadress. Vänligen klicka på länken i mailet för att verifiera din emailadress.</p>
      <p>Om du inte har fått något email, vänligen kolla i din skräppost eller fyll i din emailadress nedan och klicka på knappen för att skicka ett nytt email.</p>
      <form onSubmit={handleSubmit}>
        <label>
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <button type="submit">Skicka nytt email</button>
      </form>
    </div>
  )
}