import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";
import truncateText from "./truncateText";
import serveTea from "@/lib/i18nServer";
import { getLocale } from "./getLocale";
import { cookies, headers } from "next/headers";

export async function buildMetadata(
  {
    title,
    description,
    og_url,
    og_image_url,
  }: {
    title: string | null | undefined;
    description: string | null | undefined;
    og_url: string | undefined;
    og_image_url: string | undefined;
  }): Promise<Metadata> {
  
  const [cookieContent, headerContent] = await Promise.all([
    cookies(),
    headers(),
  ]);

  const locale = getLocale(
    cookieContent.get("locale")?.value,
    headerContent.get("accept-language"),
  );

  const t = await serveTea('metadata')

  // Truncates metadata text to fit commonly used lengths (60 for title, 150 for description)
  title = truncateText(title, 60 - t("metadata:default.title").length);
  description = truncateText(description, 150);

  return {
    title: `${title ? `${title} | ${t("metadata:default.title")}` : t("metadata:default.title")}`,
    description: description ?? t("metadata:default.description"),
    icons: "/favicon/favicon.svg",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: og_url || '/'
    },
    openGraph: {
      title: `${title ? `${title} | ${t("metadata:default.title")}` : t("metadata:default.title")}`,
      description: description ?? t("metadata:default.description"),
      images: [{
        url: og_image_url || '/images/og_solar.png'
      }],
      type: "website",
      url: og_url || '/',
      siteName: "Eco - Planner",
      locale: locale 
    }
  };
}