import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";

const default_title: string = 'Eco - planner'
const default_description: string = 'Ett verktyg som stödjer Sveriges klimatomställning genom lokala handlingsplaner, gemensam åtgärdsdatabas och samarbete kring färdplaner.'
const default_image_path: string = '/images/solarpanels_small.jpg'

// TODO: Ensure description not longer than 150chars
// TODO: Ensure title not to long either 
// TODO: Dynamically resize image using code
export function buildMetadata(
  {
    title,
    description,
    image_url,
    og_url
  }: {
    title: string | null | undefined;
    description: string | null | undefined;
    image_url?: string | URL
    og_url: string | undefined
  }): Metadata {
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