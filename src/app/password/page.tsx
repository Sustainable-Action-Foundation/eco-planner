'use client';

import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { useClientLocale, validateDict } from "@/functions/clientLocale";
import dict from "./page.dict.json" assert { type: "json" };

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendReset', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  validateDict(dict);
  const locale = useClientLocale();

  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbResetPassword[locale]}`]} />

      <div>
        <p>{dict.forgotPassword[locale]}</p>
        <form onSubmit={handleSubmit}>
          <label>
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder={dict.emailPlaceholder[locale]} name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit">{dict.sendEmail[locale]}</button>
        </form>
      </div>
    </>
  )
}