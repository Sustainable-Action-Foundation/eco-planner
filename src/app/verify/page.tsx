'use client';

import sendVerificationEmail from "@/functions/sendVerificationEmail";
import Image from "next/image";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  sendVerificationEmail(emailAdress).then(() => {
    alert('Ett nytt email har skickats till din emailadress')
  }).catch((e) => {
    alert(`Misslyckades med att skicka email. Anledning: ${e}`)
  })
}

export default function Page() {
  return (
    <div>
      <p>Ett email ska ha skickats till din emailadress. Vänligen klicka på länken i mailet för att verifiera din emailadress.</p>
      <p>Om du inte har fått något email, vänligen kolla i din skräppost eller fyll i din emailadress nedan och klicka på knappen för att skicka ett nytt email.</p>
      <form onSubmit={handleSubmit}>
        <label>
          <div className="margin-y-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-x-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <button type="submit" >Skicka nytt email</button>
      </form>
    </div>
  )
}