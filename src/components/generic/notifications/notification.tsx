import styles from './notification.module.css'
import Link from "next/link"
import { IconBell } from '@tabler/icons-react'
import serveTea from "@/lib/i18nServer";

export default async function Notifications({ amount }: { amount: number }) {
  const t = await serveTea("components");

  return (
    <Link href="/" className={`flex align-items-center ${styles.link}`}>
      <div style={{position: 'relative', display: 'grid'}}>
        <IconBell role='img' aria-label={t("components:notification.icon_aria_label")} style={{minWidth: '24px'}} />
        <div style={{
          padding: '1px',
          borderRadius: '9999px', 
          fontSize: '8px',
          color: 'white',
          lineHeight: '1',
          position: 'absolute',
          top: '0',
          left: '50%',
          transform: 'translate(0, 0)'
        }}>
          <div
            style={{ 
              height: '12px', 
              minWidth: '12px', 
              padding: '2px',
              display: 'grid', 
              placeItems: 'center', 
              backgroundColor: 'red', 
              borderRadius: '9999px', 
            }}>
            {amount <= 99 ? amount : '+99' }
          </div>
        </div>
      </div>
    </Link>
  )
} 