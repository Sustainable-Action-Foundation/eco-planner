import Signup from "@/components/forms/userInfo/signup";
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import styles from "./page.module.css" with { type: "css" };
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata() {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:signup.title"),
    description: t("metadata:signup.description"),
    og_url: `/signup`,
    og_image_url: '/images/og_hydro.png',
  })
}

export default async function Page() {
  const t = await serveTea("pages");
  return (
    <>
      <Breadcrumb customSections={[t("pages:signup.breadcrumb")]} />

      <main className={`${styles.gridLayout} container margin-auto padding-block-500 grid gap-300 align-items-center`}>
        <Signup />
        <div className={`${styles.image} position-relative width-100 rounded overflow-hidden`}>
          <AttributedImage src="/images/hydro.jpg" alt="" sizes="(max-width: 1250px) 100vw, 555px">
            <div className="width-100 padding-100">
              <AttributeText
                author="Dan Meyers"
                authorLink="https://unsplash.com/@dmey503?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
                source="Unsplash"
                sourceLink="https://unsplash.com/photos/aerial-photography-of-body-of-water-w6X7XaolqA0?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
              />
            </div>
          </AttributedImage>
        </div>
      </main>
    </>
  )
}