'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
// import VerifyButton from "@/components/forms/verify/verifyButton";
// import { buildMetadata } from "@/functions/buildMetadata";

// TODO: Allow metadata by moving to server, with a client component for the button
// export async function generateMetadata() {
//   return buildMetadata({
//     title: 'Slutför verifiering',
//     description: undefined,
//     og_url: '/verify/verify'
//   })
// }

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
          {/* <VerifyButton /> */}
          <button type="button" className="seagreen color-purewhite font-weight-bold width-100" style={{ fontSize: '1rem' }} onClick={verify}>{t("pages:verify_verify.submit")}</button>
        </div>
      </main>
    </>
  )
}