'use client';

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import dict from "./page.dict.json" with { type: "json" };
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAddress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAddress }), 'POST')
}

export default function Page() {
  const locale = useContext(LocaleContext);

  return (
    <div>
      <p>{dict.emailVerification[locale]}</p>
      <p>{dict.retryInfo[locale]}</p>
      <form onSubmit={handleSubmit}>
        <label>
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="email" placeholder={dict.emailPlaceholder[locale]} name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <button type="submit">{dict.sendNewEmail[locale]}</button>
      </form>
    </div>
  )
}