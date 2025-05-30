import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import { baseUrl } from '@/lib/baseUrl.ts'
import I18nProvider from "@/lib/i18nClient";
import { initI18nServer, t } from "@/lib/i18nServer";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/functions/getLocale";

export default async function RootLayout(
  { children, }: { children: React.ReactNode, }
) {
  const locale = getLocale(
    (await cookies()).get("locale")?.value,
    (await headers()).get("accept-language"),
  );

  await initI18nServer(locale);

  return (
    <html lang={locale}>
      <head>
        {/* TODO: Lots of this should be dynamic probably */}
        <title>{(t("common:layout.app_name"))}</title>
        <link rel="icon" type="image/svg+xml" href="/icons/leaf.svg" />
        <meta name="description" content={t("common:layout.meta_description")} />

        {/* Open Graph Meta Tags */}
        {/* Required tags */}
        <meta property="og:title" content={t("common:layout.app_name")} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:image" content={`${baseUrl}/images/solarpanels.jpg`} />

        {/* Optional tags */}
        <meta name="og:site_name" content={t("common:layout.app_name")} />
        <meta property="og:locale" content={t("common:layout.og_locale")} />

        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --i18n-optional: "${t("common:css.optional")}";
            }
        `}}></style>
      </head>
      <body>
        <I18nProvider lng={locale}>
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