"use server";

import serveTea from "@/lib/i18nServer";
import VerifyButton from "@/components/forms/verify/verifyButton";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  const t = await serveTea(["pages", "metadata"]);

  return buildMetadata({
    title: t("pages:verify_verify.title"),
    description: t("metadata:verify_verify.description"),
    og_url: '/verify/verify',
    og_image_url: undefined
  })
}

export default async function Page() {
  const t = await serveTea("pages");
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