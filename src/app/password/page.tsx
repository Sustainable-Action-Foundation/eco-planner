'use client';

import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import dict from "./page.dict.json" assert { type: "json" };
import { getClientLocale, validateDict } from "@/functions/clientLocale";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendReset', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  validateDict(dict);
  const locale = getClientLocale();

  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbResetPassword[locale]}`]} />

      <div>
        <p>Har du glömt ditt lösenord? Fyll i din email här så skickar vi ett mail med instruktioner för att återställa lösenordet.</p>
        <form onSubmit={handleSubmit}>
          <label>
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder="email" name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit">Skicka mail</button>
        </form>
      </div>
    </>
  )
}