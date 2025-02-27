import Sidebar from '@/components/generic/header/sidebar'
import { baseUrl } from '@/lib/baseUrl.ts'
import '@/styles/global.css'
import styles from './page.module.css' with { type: "css" }
import { getServerLocale } from '@/functions/serverLocale'
import parentDict from './home.dict.json' with { type: "json" };
import LocaleProvider from './context/localeContext.tsx'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  const dict = parentDict.layout;
  const locale = await getServerLocale();

  return (
    <html lang={locale}>
      <head>
        {/* TODO: Lots of this should be dynamic probably */}
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />

        <meta name="description" content={dict.head.description[locale]} />

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
        <meta property="og:description" content={dict.head.og.description[locale]} />
        <meta property="og:image" content={`${baseUrl}/images/roadmap.jpg`} />
        <meta property="og:locale" content={dict.head.og.locale[locale]} />

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