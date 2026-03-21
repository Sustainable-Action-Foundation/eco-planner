import '@/styles/global.css'
import Sidebar from '@/components/generic/header/sidebar'
import styles from './page.module.css' with { type: "css" }
import I18nProvider from "@/lib/i18nClient";
import serveTea from "@/lib/i18nServer";
import { cookies, headers } from "next/headers";
import { getLocale } from "@/functions/getLocale";
import { ToastContext, useToastContext } from '@/context/context';
import ToastList from '@/components/form/forms/toastList';

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
      <body className='neutral-background'>
        <I18nProvider lng={locale}>
          <div className={`${styles.layout}`}>
            <Sidebar />
            <ToastContext>
              <div className='padding-100' style={{ minWidth: '0' }}>
                <div className='container margin-inline-auto'>
                  {children}
                </div>
                {/*
              Note: We set minWidth 0 here to prevent unexpected issues with this grid item becoming to large.
              Per the documentation (https://www.w3.org/TR/css3-grid-layout/#min-size-auto) grid items have a default
              min width of auto which means that they cannot be smaller than their smallest child. While this seemingly 
              shouldnt be an issue, large items in a scrollable container does seem to expand this grid if they are
              larger than the screen size. (See actionTimeline.tsx for an example)
              
              setting minWidth to 0 here is not ideal as this element is very high up in the HTML hierarchy and it 
              might cause issues further down. It could further lead to issues with discovering/troubleshooting elements
              that become too wide on accident. minWidth: 100% does also seemingly resolve to the expected width for this
              element, that does however seem less stable and could potentially lead to issues in the other direction where
              this element refuses to become smaller than the screen (that should never cause an issue but hey who knows...)
            */}
                {children}
              </div>
              <ToastList />
            </ToastContext>
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}