import Login from "@/components/forms/userInfo/login";
import styles from "./page.module.css" with { type: "css" };
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { baseUrl } from "@/lib/baseUrl";

export async function generateMetadata() {
  const t = await serveTea("metadata");
  
  return buildMetadata({
    title: t("metadata:login.title"),
    description: t("metadata:login.description"),
    og_url: `/login`,
    og_image_url: '/images/og_wind.png',
  })
}

export default async function Page() {
  const t = await serveTea("pages");
  return (
    <>
      <Breadcrumb customSections={[t("pages:login.breadcrumb")]} />

      <main className={`${styles.gridLayout} container margin-auto padding-block-500 grid gap-300 align-items-center`}>
        <Login />
        <div className={`${styles.image} position-relative width-100 rounded overflow-hidden`}>
          <AttributedImage src="/images/wind.jpg" alt="" sizes="(max-width: 1250: 100vw), 555px">
            <div className="width-100 padding-100">
              <AttributeText
                author="Nicholas Doherty"
                authorLink="https://unsplash.com/@nrdoherty?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
                source="Unsplash"
                sourceLink="https://unsplash.com/photos/white-electic-windmill-pONBhDyOFoM?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
              />
            </div>
          </AttributedImage>
        </div>
      </main>
    </>
  )
}