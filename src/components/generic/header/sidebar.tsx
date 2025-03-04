import LogoutButton from '@/components/buttons/logoutButton'
import LanguageSwitcher from "@/components/cookies/languageSwitcher"
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import styles from './header.module.css' with { type: "css" }
import { createDict } from "../generic.dict.ts";
import { getServerLocale } from '@/functions/serverLocale'

export default async function Sidebar() {
  const [{ user }, locale] = await Promise.all([
    getSession(cookies()),
    getServerLocale(),
  ])
  const dict = createDict(locale).header.sidebar;

  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <Image src='/icons/menu.svg' alt={dict.aside.toggleMenu} width='24' height='24' />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className={styles.link}>
              <Image src='/icons/user.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.myAccount}
            </Link>
            :
            <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap' }}>
              <Image src='/icons/userAdd.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.createAccount}
            </Link>
          }
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <Image src='/icons/home.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.home}
            </Link>
            <Link href="/info" className={styles.link}>
              <Image src='/icons/info.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.aboutTheTool}
            </Link>
          </div>
          <div className='flex justify-content-center margin-bottom-200'>
            <LanguageSwitcher />
          </div>
          {user?.isLoggedIn ?
            <LogoutButton />
            :
            <Link href="/login" className={styles.link}>
              <Image src='/icons/login.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.login}
            </Link>
          }
        </nav>
      </aside>
    </aside>
  </>
}
