import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";
import { t } from "i18next";

// TODO: Add i18n support
const default_title: string = 'Eco - planner';
const default_description: string = 'Ett verktyg som stödjer Sveriges klimatomställning genom lokala handlingsplaner, gemensam åtgärdsdatabas och samarbete kring färdplaner.';
const default_image_path: string = '/images/og_solar.png'; // TODO: See how we can make these smaller

// TODO: Export this function?
// Truncates text after the end of a word
function truncateText(string: string | null | undefined, maxLength: number): string | undefined {
  if (!string) return;
  if (string.length <= maxLength) return string;

  const truncatedString = string.slice(0, maxLength);
  return truncatedString.slice(0, truncatedString.lastIndexOf(' ')) + '…';
}

// TODO: Dynamically set locale
// TODO: Decide on if the image should be optional or not, does an og image make sense for the graph pages i.e goal/[id]/edit?
export function buildMetadata(
  {
    title,
    description,
    image_url, // TODO: Should be og_image_url
    og_url
  }: {
    title: string | null | undefined;
    description: string | null | undefined;
    image_url?: string | URL;
    og_url: string | undefined;
  }): Metadata {

  // Truncates metadata text to fit commonly used lengths
  title = truncateText(title, 60 - default_title.length);
  description = truncateText(description, 150);

  return {
    title: `${title ? `${title} | ${default_title}` : default_title}`,
    description: description ?? default_description,
    icons: "/icons/leaf.svg",

    openGraph: {
      title: `${title ? `${title} | ${default_title}` : default_title}`,
      description: description ?? default_description,
      images: [{
        url: image_url ?? default_image_path
      }],
      type: "website",
      url: `${og_url ? `${baseUrl}${og_url}` : baseUrl}`,
      siteName: "Eco - Planner",
      locale: "sv_SE"
    }
  };
}