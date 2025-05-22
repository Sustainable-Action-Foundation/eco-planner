"use server";

import serveTea from "@/lib/i18nServer";
import VerifyButton from "@/components/forms/verify/verifyButton";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  return buildMetadata({
    title: 'Slutför verifiering',
    description: undefined,
    og_url: '/verify/verify'
  })
}

export default async function Page() {
  const t = await serveTea();
  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:verify_verify.title")}</h1>
        <p>{t("pages:verify_verify.description")}</p>
        <VerifyButton />
      </div>
    </main>
  )
}