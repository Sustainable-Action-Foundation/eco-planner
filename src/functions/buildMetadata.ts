import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";
import serveTea from "@/lib/i18nServer";

// TODO METADATA: Export this function?
// Truncates text after the end of a word
function truncateText(string: string | null | undefined, maxLength: number): string | undefined {
  if (!string) return;
  if (string.length <= maxLength) return string;

  const truncatedString = string.slice(0, maxLength);
  return truncatedString.slice(0, truncatedString.lastIndexOf(' ')) + '…';
}

// TODO METADATA: Dynamically set locale
// TODO METADATA: Any unintended side effects of this being async?
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
  
  const t = await serveTea('metadata')

  // Truncates metadata text to fit commonly used lengths
  title = truncateText(title, 60 - t("metadata:default.title").length);
  description = truncateText(description, 150);

  return {
    title: `${title ? `${title} | ${t("metadata:default.title")}` : t("metadata:default.title")}`,
    description: t("metadata:default.description"),
    icons: "/icons/leaf.svg",

    openGraph: {
      title: `${title ? `${title} | ${t("metadata:default.title")}` : t("metadata:default.title")}`,
      description: description ?? t("metadata:default.description"),
      images: [{
        url: og_image_url ?? '/images/og_solar.png'
      }],
      type: "website",
      url: `${og_url ? `${baseUrl}${og_url}` : baseUrl}`,
      siteName: "Eco - Planner",
      locale: "sv_SE" // TODO METADATA: Set this dynamically 
    }
  };
}