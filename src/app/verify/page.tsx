'use client';

import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { useTranslation } from "react-i18next";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendVerification', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  const { t } = useTranslation();
  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:verify.title")}</h1>
        <p>{t("pages:verify.description")}</p>
        <h2 className="margin-top-200 margin-bottom-50" style={{ fontSize: '1.25rem' }}>{t("pages:verify.troubleshooting_title")}</h2>
        <p className="margin-top-0">{t("pages:verify.troubleshooting_description")}</p>
        <form onSubmit={handleSubmit} className="flex gap-50 flex-wrap-wrap align-items-center">
          <label className="flex-grow-100">
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit" className="font-weight-500" style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}>{t("pages:verify.submit_resend")}</button>
        </form>
      </div>
    </main>
  )
}