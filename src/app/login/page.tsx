import Login from "@/components/forms/userInfo/login";
import styles from "./page.module.css" with { type: "css" };
import AttributedImage from "@/components/generic/images/attributedImage";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import dict from "./page.dict.json" assert { type: "json" };
import { getServerLocale, validateDict } from "@/functions/serverLocale";

export default async function Page() {
  validateDict(dict);
  const locale = getServerLocale();
  
  return (
    <>
      <Breadcrumb customSections={[`${dict.breadcrumbLogin[locale]}`]} />

      <main className={`${styles.gridLayout} container margin-auto padding-block-500 grid gap-300 align-items-center`}>
        <Login />
        <div className={`${styles.image} position-relative width-100 rounded overflow-hidden`}>
          <AttributedImage src="/images/windturbines.jpg" alt="">
            <div className="width-100 padding-100">
              Photo by <a className="color-purewhite" href="https://unsplash.com/@nrdoherty?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Nicholas Doherty</a> on <a className="color-purewhite" href="https://unsplash.com/photos/white-electic-windmill-pONBhDyOFoM?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Unsplash</a>
            </div>
          </AttributedImage>
        </div>
      </main>
    </>
  )
}