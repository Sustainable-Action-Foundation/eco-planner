import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import SendResetMail from "@/components/forms/password/resetPassword";
import { buildMetadata } from "@/functions/buildMetadata";
import serveTea from "@/lib/i18nServer";

export async function generateMetadata() {
  return buildMetadata({
    title: 'Återställ lösenord',
    description: undefined,
    og_url: '/password'
  })
}

export default async function Page() {
  const t = await serveTea();
  return (
    <>
      <Breadcrumb customSections={[t("pages:password.breadcrumb")]} />

      <main>
        {/* TODO METADATA: Why are theese translations behaving weird? */}
        <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
          <h1>{t("pages:password.title")}</h1>
          <p>{t("pages:password.description")}</p>
          <SendResetMail />
        </div>
      </main>
    </>
  )
}