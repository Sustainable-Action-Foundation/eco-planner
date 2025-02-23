import styles from './notification.module.css'
import Link from "next/link"
import Image from "next/image"
import dict from "./notification.dict.json" assert { type: "json" };
import { useClientLocale, validateDict } from '@/functions/clientLocale';

export default function Notifications({ amount }: { amount: number }) {
  validateDict(dict);
  const locale = useClientLocale();

  return (
    <Link href="/" className={`flex align-items-center ${styles.link}`}>
      <div style={{position: 'relative', display: 'grid'}}>
        <Image src="/icons/bell.svg" alt={dict.notifications.notificationsAlt[locale]} width={24} height={24} />
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