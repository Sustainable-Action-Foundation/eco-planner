import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import Signup from "@/components/forms/userInfo/signup";
import AttributedImage from "@/components/generic/images/attributedImage";
import styles from "./page.module.css" with { type: "css" };
import { getServerLocale } from "@/functions/serverLocale";
import { createDict } from "./signup.dict.ts";

export default async function Page() {
  const locale = await getServerLocale();
  const dict = createDict(locale).page;

  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbCreateAccount}`]} />

      <main className={`${styles.gridLayout} container margin-auto padding-block-500 grid gap-300 align-items-center`}>
        <Signup />
        <div className={`${styles.image} position-relative width-100 rounded overflow-hidden`}>
          <AttributedImage src="/images/hydroelectric.jpg" alt="">
            <div className="width-100 padding-100">
              {dict.photoBy} <a className="color-purewhite" href="https://unsplash.com/@dmey503?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Dan Meyers</a> {dict.on} <a className="color-purewhite" href="https://unsplash.com/photos/aerial-photography-of-body-of-water-w6X7XaolqA0?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Unsplash</a>
            </div>
          </AttributedImage>
        </div>
      </main>
    </>
  )
}