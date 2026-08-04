import "server-only";
import serveTea from "@/lib/i18nServer";
import VerifyButton from "@/components/form/forms/verifyButton";
import { buildMetadata } from "@/functions/buildMetadata";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea(["pages", "metadata"]);

  return buildMetadata({
    title: t("pages:verify_confirm.title"),
    description: t("metadata:verify_confirm.description"),
    og_url: `/verify/confirm`,
    og_image_url: undefined,
  });
}

export default async function Page() {
  const t = await serveTea("pages");
  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:verify_confirm.title")}</h1>
        <p>{t("pages:verify_confirm.description")}</p>
        <VerifyButton />
      </div>
    </main>
  );
}