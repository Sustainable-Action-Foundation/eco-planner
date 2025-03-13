import '@/styles/global.css'
import "@/lib/i18nServer";
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import { baseUrl } from '@/lib/baseUrl.ts'
import I18nProvider from "@/lib/i18nClient";
import { t } from "@/lib/i18nServer";
import { cookies } from "next/headers";
import { match } from "@formatjs/intl-localematcher";
import { Locales, uniqueLocales } from "i18n.config";

export default function RootLayout(
  { children, }: { children: React.ReactNode, }
) {
  const cookieLocale = cookies().get("locale")?.value;
  const locale = cookieLocale
    ? match([cookieLocale], uniqueLocales, Locales.default)
    : Locales.default;

  return (
    <html lang={locale}>
      <head>
        {/* TODO: Lots of this should be dynamic probably */}
        <title>{t("common:app_name")}</title>
        <link rel="icon" type="image/svg+xml" href="/icons/leaf.svg" />
        <meta name="description" content={t("common:meta_description")} />

        {/* Open Graph Meta Tags */}
        {/* Required tags */}
        <meta property="og:title" content={t("common:app_name")} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:image" content={`${baseUrl}/images/solarpanels.jpg`} />

        {/* Optional tags */}
        <meta name="og:site_name" content={t("common:app_name")} />
        <meta property="og:locale" content={t("og_locale")} />
      </head>
      <body>
        <I18nProvider>
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