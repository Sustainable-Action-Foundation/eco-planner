import Sidebar from '@/components/generic/header/sidebar'
import { baseUrl } from '@/lib/baseUrl.ts'
import '@/styles/global.css'
import styles from './page.module.css' with { type: "css" }
import { getServerLocale } from '@/functions/serverLocale'
import { createDict } from "./home.dict.ts";
import LocaleProvider from './context/localeContext.tsx'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  const locale = await getServerLocale();
  const dict = createDict(locale).layout;

  return (
    <html lang={locale}>
      <head>
        {/* TODO: Lots of this should be dynamic probably */}
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />

        <meta name="description" content={dict.head.description} />

        {/* Open Graph Meta Tags */}
        {/* Required tags */}
        <meta property="og:title" content="Eco - Planner" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:image" content={`${baseUrl}/images/solarpanels.jpg`} />

        {/* Optional tags */}
        <meta name="og:site_name" content="Eco - Planner" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Eco - Planner" />
        <meta property="og:description" content={dict.head.og.description} />
        <meta property="og:image" content={`${baseUrl}/images/roadmap.jpg`} />
        <meta property="og:locale" content={dict.head.og.locale} />

      </head>
      <body>
        <div className={`${styles.layout}`}>
          <LocaleProvider serverLocale={locale}>
            <Sidebar />
            <div className='padding-100 flex-grow-100' style={{ backgroundColor: '#fdfdfd' }}>
              <div className='container margin-inline-auto'>
                {children}
              </div>
            </div>
          </LocaleProvider>
        </div>
      </body>
    </html>
  )
}