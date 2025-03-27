import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import { baseUrl } from '@/lib/baseUrl.ts'
import type { Metadata } from 'next'

{/* TODO:
  Icons: Add ios/android/... icons
*/}

export const metadata: Metadata = {
  title: 'Eco - Planner',
  icons: "/icons/leaf.svg",
  description: "Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.",
  openGraph: {
    title: 'Eco - Planner',
    type: 'website',
    url: baseUrl,
    images: [{
      url: `${baseUrl}/images/solarpanels.jpg`
    }],
    siteName: 'Eco - Planner',
    description: "Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.",
    locale: 'sv_SE'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {

  return (
    <html lang="sv">
      <head></head>
      <body>
        <div className={`${styles.layout}`}>
          <Sidebar />
          <div className='padding-100 flex-grow-100' style={{ backgroundColor: '#fdfdfd' }}>
            <div className='container margin-inline-auto'>
              {children}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}