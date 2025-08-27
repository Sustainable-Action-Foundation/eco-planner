import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import I18nProvider from "@/lib/i18nClient";
import serveTea from "@/lib/i18nServer";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/functions/getLocale";

export default async function RootLayout(
  { children, }: { children: React.ReactNode, }
) {
  const [cookieContent, headerContent] = await Promise.all([
    cookies(),
    headers(),
  ]);

  const locale = getLocale(
    cookieContent.get("locale")?.value,
    headerContent.get("accept-language"),
  );

  const t = await serveTea("common");

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
            <div className='padding-100 flex-grow-100' style={{ backgroundColor: '#f6f6f6' }}>
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