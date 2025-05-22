"use server";

import VerifyForm from "@/components/forms/verify/verifyForm.tsx";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  const t = await serveTea();

  return buildMetadata({ 
    title: t("pages:verify.title"),
    description: t("pages:verify.description"),  
    og_url: '/verify'
  })
}

export default async function Page() {
  const t = await serveTea();
  return (
    <main>
      {/* TODO METADATA: Why are theese translations behaving weird? */}
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:verify.title")}</h1>
        <p>{t("pages:verify.description")}</p>
        <h2 className="margin-top-200 margin-bottom-50" style={{ fontSize: '1.25rem' }}>{t("pages:verify.troubleshooting_title")}</h2>
        <p className="margin-top-0">{t("pages:verify.troubleshooting_description")}</p>
        <VerifyForm />
      </div>
    </main>
  )
}