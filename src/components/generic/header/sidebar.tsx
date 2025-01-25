import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
// import Notifications from '../notifications/notification'

export default async function Sidebar() {
  const { user } = await getSession(cookies())
  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <Image src='/icons/menu.svg' alt='Toggle menu' width='24' height='24' />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className={styles.link}>
              <Image src='/icons/user.svg' alt='' width={24} height={24} />
              Mitt Konto
            </Link>
          :
            <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap' }}>
              <Image src='/icons/userAdd.svg' alt='' width={24} height={24} />
              Skapa Konto
            </Link>
          }
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <Image src='/icons/home.svg' alt='' width={24} height={24} />
              Hem
            </Link>
            <Link href="/info" className={styles.link}>
              <Image src='/icons/info.svg' alt='' width={24} height={24} />
              Om verktyget
            </Link>
          </div>
          {user?.isLoggedIn ?
            <LogoutButton />
          :
            <Link href="/login" className={styles.link}>
              <Image src='/icons/login.svg' alt='' width={24} height={24} />
              Logga In
            </Link>
          }
        </nav>
      </aside>
    </aside>
  </>
}
