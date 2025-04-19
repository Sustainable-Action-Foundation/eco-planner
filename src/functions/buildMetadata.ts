import { baseUrl } from "@/lib/baseUrl";
import { Metadata } from "next";

export function buildMetadata(
  {
    title,
    description,
    image
  }: {
    title: string;
    description: string;
    image: string
  }): Metadata {
  return {
    title,
    description: description,
    icons: "/icons/leaf.svg",
    openGraph: {
      title,
      description: description,
      images: [{ url: image }],
      type: "website",
      url: baseUrl,
      siteName: "Eco - Planner",
      locale: "sv_SE"
    }
  };
}