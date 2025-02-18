'use client';

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { getClientLocale, validateDict } from "@/functions/clientLocale";
import dict from "./page.dict.json" assert { type: "json" };

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAddress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAddress }), 'POST')
}

export default function Page() {
  validateDict(dict);
  const locale = getClientLocale();

  return (
    <div>
      <p>{dict.emailVerification[locale]}</p>
      <p>{dict.retryInfo[locale]}</p>
      <form onSubmit={handleSubmit}>
        <label>
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <button type="submit">{dict.sendNewEmail[locale]}</button>
      </form>
    </div>
  )
}