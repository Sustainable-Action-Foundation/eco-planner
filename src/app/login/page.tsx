import Login from "@/components/forms/userInfo/login";
import styles from "./page.module.css" with { type: "css" };
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { t } from "@/lib/i18nServer";

export default async function Page() {
  return (
    <>
      <Breadcrumb customSections={[t("pages:login.breadcrumb")]} />

      <main className={`${styles.gridLayout} container margin-auto padding-block-500 grid gap-300 align-items-center`}>
        <Login />
        <div className={`${styles.image} position-relative width-100 rounded overflow-hidden`}>
          <AttributedImage src="/images/windturbines.jpg" alt="" sizes="(max-width: 1250: 100vw), 555px">
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