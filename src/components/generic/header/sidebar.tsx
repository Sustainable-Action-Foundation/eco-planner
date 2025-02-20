import LogoutButton from '@/components/buttons/logoutButton'
import LanguageSwitcher from "@/components/cookies/languageSwitcher"
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import styles from './header.module.css' with { type: "css" }
import dict from "./sidebar.dict.json" assert {type: "json"};
import { getServerLocale, validateDict } from '@/functions/serverLocale'

export default async function Sidebar() {
  const [{ user }, locale, _] = await Promise.all([
    getSession(cookies()),
    getServerLocale(),
    validateDict(dict),
  ])

  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <Image src='/icons/menu.svg' alt={dict.aside.toggleMenu[locale]} width='24' height='24' />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          <div>
            { // Link to signup if not logged in
              !user?.isLoggedIn &&
              <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap' }}>
                <Image src='/icons/userAdd.svg' alt='' width={24} height={24} />
                {dict.aside.aside.nav.createAccount[locale]}
              </Link>
            }
            { // Link to user page if logged in
              // Disabled until we have something to show there
              // user?.isLoggedIn &&
              // <div>
              //   <Link href={`/user/${user.username}`} className={styles.link}>
              //     <Image src='/icons/user.svg' alt='' width={24} height={24} />
              //     Mitt Konto
              //   </Link>
              //   {/*<Notifications amount={} /> */}
              // </div>
            }
          </div>
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <Image src='/icons/home.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.home[locale]}
            </Link>
            <Link href="/info" className={styles.link}>
              <Image src='/icons/info.svg' alt='' width={24} height={24} />
              {dict.aside.aside.nav.aboutTheTool[locale]}
            </Link>
          </div>
          <div className='flex justify-content-center margin-bottom-200'>
            <LanguageSwitcher />
          </div>
          <div>
            { // Link to login
              !user?.isLoggedIn &&
              <>
                <Link href="/login" className={styles.link}>
                  <Image src='/icons/login.svg' alt='' width={24} height={24} />
                  {dict.aside.aside.nav.login[locale]}
                </Link>
              </>
            }
            { // Link to admin page and a logout button if logged in
              user?.isLoggedIn &&
              <>
                {/* Admin pages don't currently exist */}
                {/* <Link href="/admin">To Admin Page</Link> */}
                <LogoutButton />
              </>
            }
          </div>
        </nav>
      </aside>
    </aside>
  </>
}
