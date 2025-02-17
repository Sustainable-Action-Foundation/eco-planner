import Sidebar from '@/components/generic/header/sidebar'
import { baseUrl } from '@/lib/baseUrl.ts'
import '@/styles/global.css'
import styles from './page.module.css' with { type: "css" }
import { getServerLocale, validateDict } from '@/functions/serverLocale'
import dict from './layout.dict.json';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode,
}) {
  validateDict(dict);
  const locale = getServerLocale();

  return (
    <html lang={locale}>
      <head>
        <title>Eco - Planner</title>
        <link rel="icon" type="image/x-icon" href="/icons/leaf.svg" />

        <meta name="description" content={dict.head.description[locale]} />

        {/* Open Graph Meta Tags */}
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