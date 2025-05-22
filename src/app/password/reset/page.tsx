import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import ResetPassword from "@/components/forms/password/resetPassword";
import { buildMetadata } from "@/functions/buildMetadata";
import serveTea from "@/lib/i18nServer";

export async function generateMetadata() {
  return buildMetadata({
    title: 'Uppdatera lösenord',
    description: undefined,
    og_url: '/password/reset'
  })
}

export default async function Page() {
  const t = await serveTea("pages");
  return (
    <>
      <Breadcrumb customSections={[t("pages:password_reset.breadcrumb")]} />

      <main>
        {/* TODO METADATA: Why are theese translations behaving weird? */}
        <div className="margin-block-300 padding-inline-100 padding-bottom-100 container-text purewhite smooth" style={{ border: '1px solid var(--gray)' }}>
          <h1>{t("pages:password_reset.title")}</h1>
          <p>{t("pages:password_reset.description")}</p>
          <ResetPassword />
        </div>
      </main>
    </>
  )
}