"use server";

import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import Image from 'next/image'
import { LanguageSwitcher } from "@/components/languageSwitcher"
import serveTea from "@/lib/i18nServer";
// import Notifications from '../notifications/notification'

export default async function Sidebar() {
  const [t, { user }] = await Promise.all([
    serveTea(["components", "common"]),
    getSession(await cookies()),
  ]);

  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <Image src='/icons/menu.svg' alt={t("components:sidebar.toggle_menu_alt")} width='24' height='24' />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className={styles.link}>
              <Image src='/icons/user.svg' alt='' width={24} height={24} />
              {t("components:sidebar.my_profile")}
            </Link>
            :
            <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap' }}>
              <Image src='/icons/userAdd.svg' alt='' width={24} height={24} />
              {t("components:sidebar.create_account")}
            </Link>
          }
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <Image src='/icons/home.svg' alt='' width={24} height={24} />
              {t("components:sidebar.home")}
            </Link>
            <Link href="/info" className={styles.link}>
              <Image src='/icons/info.svg' alt='' width={24} height={24} />
              {t("components:sidebar.about")}
            </Link>
          </div>
          <div className={`${styles['menu-settings-wrapper']}`}>
            <label className={`${styles.link} justify-content-space-between`}>
              <div className='flex align-items-center gap-50'>
                <Image src='/icons/globe.svg' alt='' width={24} height={24} />
                {t("components:sidebar.language")}
              </div>
              <Image src='/icons/caret-right.svg' alt='' width={16} height={16} />
              {/* TODO: Some kind of indication showing this is checked? */}
              <input type='checkbox' className='display-none' />
            </label>
            <fieldset className={`${styles['menu-settings-container']} fieldset-unset-pseudo-class`}>
              <legend className=' font-weight-600 padding-inline-25'>{t("components:sidebar.language_alt")}</legend>
              <LanguageSwitcher />
            </fieldset>
          </div>
          {user?.isLoggedIn ?
            <LogoutButton />
            :
            <Link href="/login" className={styles.link}>
              <Image src='/icons/login.svg' alt='' width={24} height={24} />
              {t("common:tsx.login")}
            </Link>
          }
        </nav>
      </aside>
    </aside>
  </>
}
