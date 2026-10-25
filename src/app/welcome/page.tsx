import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import serveTea from "@/lib/i18nServer";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/functions/buildMetadata";
import { safeRedirectPath } from "@/functions/safeRedirectPath";
import NameForm from "@/components/form/forms/nameForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea(["pages", "metadata"]);
  return buildMetadata({
    title: t("pages:welcome.title"),
    description: t("metadata:welcome.description"),
    og_url: `/welcome`,
    og_image_url: undefined,
  });
}

/**
 * Onboarding: the first login link lands here (and so does any later login of a
 * user who never filled it in) to ask for the person's first and last name, then
 * continues to where the login was headed. Login itself is only the email address.
 */
export default async function Page(props: { searchParams: Promise<{ from?: string | string[] }> }) {
  const [t, searchParams, session] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getSession(await cookies()),
  ]);
  const from = safeRedirectPath(Array.isArray(searchParams.from) ? searchParams.from[0] : searchParams.from);

  if (!session.user?.isLoggedIn) {
    redirect(`/login?from=${encodeURIComponent(`/welcome?from=${encodeURIComponent(from)}`)}`);
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { first_name: true, last_name: true },
  });

  return (
    <main>
      <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text margin-inline-auto purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:welcome.title")}</h1>
        <p>{t("pages:welcome.description")}</p>
        <NameForm firstName={user?.first_name} lastName={user?.last_name} redirectTo={from} />
      </div>
    </main>
  );
}
