import type { MetadataRoute } from 'next'
import serveTea from "@/lib/i18nServer";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  
  const t = await serveTea('metadata')
  
  return {
    name: t("metadata:default.title"),
    short_name: t("metadata:default.short_title"),
    description: t("metadata:default.description"),
    start_url: '/',
    display: 'standalone',
    background_color: '#191919',
    theme_color: '#fefefe',
    icons: [
      {
        src: '/favicon/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      }, 
      {
        src: '/favicon/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      }, 
    ],
  }
}