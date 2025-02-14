import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import { baseUrl } from '@/lib/baseUrl.ts'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  return (
    <html lang="sv">
      <head>
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />


        <meta name="description" content="Ett verktyg som syftar till att bidra till Sveriges klimatomställning. 
        I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. 
        Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. 
        Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder. "/>

        {/* Open Graph Meta Tags */}
        <meta name="og:site_name" content="Eco - Planner" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Eco - Planner" />
        <meta property="og:description" content="Ett verktyg som syftar till att bidra till Sveriges klimatomställning. 
        I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. 
        Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. 
        Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder." />
        <meta property="og:image" content={`${baseUrl}/images/roadmap.jpg`} />
        <meta property="og:locale" content="sv_SE" />

      </head>
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