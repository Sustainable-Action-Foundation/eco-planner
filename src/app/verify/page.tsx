'use client';

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import parentDict from "./verify.dict.json" with { type: "json" };
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
  const dict = parentDict.page;
  const locale = useContext(LocaleContext);

  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{border: '1px solid var(--gray)'}}>
        <h1 className="padding-bottom-100" style={{borderBottom: '1px solid var(--gray)'}}>{dict.verifyEmail[locale]}</h1>
        <p>{dict.emailVerification[locale]}</p>
        <h2 className="margin-top-200 margin-bottom-50" style={{fontSize: '1.25rem'}}>{dict.noEmailReceived[locale]}</h2>
        <p className="margin-top-0">{dict.retryInfo[locale]}</p>
        <form onSubmit={handleSubmit} className="flex gap-50 flex-wrap-wrap align-items-center">
          <label className="flex-grow-100">
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder={dict.emailPlaceholder[locale]} name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit" className="font-weight-500" style={{fontSize: '1rem', minHeight: 'calc(24px + 1rem)'}}>{dict.sendNewEmail[locale]}</button>
        </form>
      </div>
    </main>
  )
}