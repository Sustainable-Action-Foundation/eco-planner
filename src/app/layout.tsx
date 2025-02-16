import Sidebar from '@/components/generic/header/sidebar'
import { DEFAULT_LOCALE } from '@/constants'
import { baseUrl } from '@/lib/baseUrl.ts'
import '@/styles/global.css'
import { Locale } from '@/types'
import { headers } from 'next/headers'
import { BgetDictionary } from './dictionaries'
import styles from './page.module.css' with { type: "css" }

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  const locale = headers().get("locale") as Locale || DEFAULT_LOCALE as Locale;

  const dict = await BgetDictionary("@/app/layout");

  return (
    <html lang="sv">
      <head>
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />


        <meta name="description" content={'head' in dict && dict.head.description[locale] || undefined} />

        {/* Open Graph Meta Tags */}
        <meta name="og:site_name" content="Eco - Planner" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Eco - Planner" />
        <meta property="og:description" content={'head' in dict && dict.head.og.description[locale] || undefined} />
        <meta property="og:image" content={`${baseUrl}/images/roadmap.jpg`} />
        <meta property="og:locale" content={'head' in dict && dict.head.og.locale[locale] || undefined} />

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