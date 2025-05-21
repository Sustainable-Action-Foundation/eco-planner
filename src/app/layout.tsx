import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
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
        {/* CSS variable containing the text indicator for optional input fields */}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --i18n-optional: "${t("common:css.optional")}";
            }
        `}} />
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