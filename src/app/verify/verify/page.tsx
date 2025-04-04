'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation();

  function verify() {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email')
    const hash = params.get('hash')

    formSubmitter('/api/verify', JSON.stringify({ email, hash }), 'PATCH')
  }

  return (
    <>
      <main>
        <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
          <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:verify_verify.title")}</h1>
          <p>{t("pages:verify_verify.description")}</p>
          <button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{ fontSize: '1rem' }} onClick={verify}>{t("pages:verify_verify.submit")}</button>
        </div>
      </main>
    </>
  )
}