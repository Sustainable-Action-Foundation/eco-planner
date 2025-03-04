'use client';

import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { createDict } from "./password.dict.ts";
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendReset', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).page;

  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbResetPassword}`]} />

      <div>
        <p>{dict.forgotPassword}</p>
        <form onSubmit={handleSubmit}>
          <label>
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder={dict.emailPlaceholder} name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit">{dict.sendEmail}</button>
        </form>
      </div>
    </>
  )
}