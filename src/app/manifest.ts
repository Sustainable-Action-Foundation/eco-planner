import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eco - planner',
    short_name: 'Eco - planner',
    description: 'Ett verktyg som stödjer Sveriges klimatomställning genom lokala handlingsplaner, gemensam åtgärdsdatabas och samarbete kring färdplaner',
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