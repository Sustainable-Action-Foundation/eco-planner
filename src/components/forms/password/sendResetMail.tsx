'use client';

import formSubmitter from "@/functions/formSubmitter"
import { useTranslation } from "react-i18next"
import Image from "next/image" 

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendReset', JSON.stringify({ email: emailAdress }), 'POST')
}


export default function SendResetMail() {
  const { t } = useTranslation();

  return (
    <form onSubmit={handleSubmit}>
      <label>
        <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
          <Image src="/icons/email.svg" alt="" width={24} height={24} />
          <input className="padding-0 margin-inline-50" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
        </div>
      </label>
      <button type="submit">{t("pages:password.submit")}</button>
    </form>
  )
}