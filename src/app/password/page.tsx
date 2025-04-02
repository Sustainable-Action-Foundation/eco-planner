'use client';

import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import formSubmitter from "@/functions/formSubmitter";
import Image from "next/image";
import { useTranslation } from "react-i18next";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const emailAdress = form.email.value

  // Send a new verification email
  formSubmitter('/api/sendReset', JSON.stringify({ email: emailAdress }), 'POST')
}

export default function Page() {
  const { t } = useTranslation();

  return (
    <>
      <Breadcrumb customSections={[t("pages:password.breadcrumb")]} />

      <div>
        <p>{t("pages:password.description")}</p>
        <form onSubmit={handleSubmit}>
          <label>
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/email.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
            </div>
          </label>
          <button type="submit">{t("pages:password.submit")}</button>
        </form>
      </div>
    </>
  )
}