"use server";

import serveTea from "@/lib/i18nServer";
import styles from './images.module.css' with { type: "css" };
import Image from "next/image";


export default async function AttributedImage({
  children,
  src,
  alt,
  sizes = "(max-width: 1250: 100vw), 1250px",
}: {
  children: React.ReactNode
  src: string,
  alt: string,
  sizes?: string,
}) {
  return (
    <>
      <Image sizes={sizes} src={src} alt={alt} fill={true} className={styles.attributedImage} priority={true} />
      <div className={styles.attribution}>
        {children}
      </div>
    </>
  )
}

export async function AttributeText(
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
  const t = await serveTea();
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
}