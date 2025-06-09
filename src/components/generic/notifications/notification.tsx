import styles from './notification.module.css'
import Link from "next/link"
import Image from "next/image"
import { IconBell } from '@tabler/icons-react'

export default function Notifications({ amount }: { amount: number }) {
  return (
    <Link href="/" className={`flex align-items-center ${styles.link}`}>
      <div style={{position: 'relative', display: 'grid'}}>
        <IconBell aria-label='notifikationer' style={{minWidth: '24px'}} />
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