import "server-only";
import serveTea from "@/lib/i18nServer";
import LoginLinkButton from "@/components/form/forms/loginLinkButton";
import { buildMetadata } from "@/functions/buildMetadata";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea(["pages", "metadata"]);

  return buildMetadata({
    title: t("pages:login_link.title"),
    description: t("metadata:login_link.description"),
    og_url: `/login/link`,
    og_image_url: undefined,
  });
}

/**
 * Interstitial for mailed login links. The token travels in the URL fragment, which
 * never reaches the server; the client component reads it and redeems it with an
 * explicit button, so link scanners that fetch this page consume nothing.
 */
export default async function Page() {
  const t = await serveTea("pages");
  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:login_link.title")}</h1>
        <LoginLinkButton />
      </div>
    </main>
  );
}
