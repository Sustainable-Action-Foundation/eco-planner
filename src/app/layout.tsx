import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import { baseUrl } from '@/lib/baseUrl.ts'
import I18nProvider from "@/lib/i18n";
import { Locales } from "@/types";

export default function RootLayout(
  {
    children,
    params,
  }: {
    children: React.ReactNode,
    params: { lang: string },
  }
) {
  return (
    <html lang={params.lang}>
      <head>
        {/* TODO: Lots of this should be dynamic probably */}
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />
        <meta name="description" content="Ett verktyg som syftar till att bidra till Sveriges klimatomställning. 
        I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. 
        Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. 
        Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder. "/>

        {/* Open Graph Meta Tags */}
        {/* Required tags */}
        <meta property="og:title" content="Eco - Planner" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:image" content={`${baseUrl}/images/solarpanels.jpg`} />

        {/* Optional tags */}
        <meta name="og:site_name" content="Eco - Planner" />
        <meta property="og:description" content="Ett verktyg som syftar till att bidra till Sveriges klimatomställning. 
        I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. 
        Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. 
        Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder." />
        <meta property="og:locale" content="sv_SE" />

      </head>
      <body>
        <I18nProvider>
          <h1>{params.lang}</h1>
          <div className={`${styles.layout}`}>
            <Sidebar />
            <div className='padding-100 flex-grow-100' style={{ backgroundColor: '#fdfdfd' }}>
              <div className='container margin-inline-auto'>
                {children}
              </div>
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return ["en", "sv"].map((lang) => ({ lang }));
  // return [...new Set(Object.values(Locales))].map((lang) => ({ lang }));
}