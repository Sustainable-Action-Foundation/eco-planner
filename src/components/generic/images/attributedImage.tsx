import { t } from "@/lib/i18nServer";
import styles from './images.module.css' with { type: "css" };
import Image from "next/image";


export default function AttributedImage({
  children,
  src,
  alt,
}: {
  children: React.ReactNode
  src: string,
  alt: string,
}) {
  return (
    <>
      <Image src={src} alt={alt} fill={true} className={styles.attributedImage} priority={true} />
      <div className={styles.attribution}>
        {children}
      </div>
    </>
  )
}

export function AttributeText(
  {
    className = "",
    author,
    authorLink,
    source,
    sourceLink,
  }: {
    className?: string,
    author: string,
    authorLink: string,
    source: string,
    sourceLink: string,
  }) {
  return (
    <p className={`margin-0 ${className}`}>
      {t("components:image_attribute.by")}
      {" "}
      <a className="color-purewhite" href={authorLink} target="_blank">
        {author}
      </a>
      {" "}
      {t("components:image_attribute.on")}
      {" "}
      <a className="color-purewhite" href={sourceLink} target="_blank">
        {source}
      </a>
    </p>
  );
  // <p className="margin-0">Photo by <a className="color-purewhite" href="https://unsplash.com/@markusspiske?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Markus Spiske</a> on <a className="color-purewhite" href="https://unsplash.com/photos/white-and-blue-solar-panels-pwFr_1SUXRo?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Unsplash</a></p>
}