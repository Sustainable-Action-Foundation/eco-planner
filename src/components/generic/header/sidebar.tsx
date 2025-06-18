"use server";

import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { LanguageSwitcher } from "@/components/languageSwitcher"
import serveTea from "@/lib/i18nServer";
import { PopoverButton, Popover } from '@/components/generic/popovers/popovers';
import { IconCirclePlus, IconHome, IconInfoCircle, IconLogin2, IconMenu2, IconPlus, IconSettings, IconUser, IconUserPlus, IconWorld, IconX } from '@tabler/icons-react'

export default async function Sidebar() {
  const [t, { user }] = await Promise.all([
    serveTea(["components", "common"]),
    getSession(await cookies()),
  ]);

  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <IconMenu2 role='img' aria-label={t("components:sidebar.toggle_menu_alt")} />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className={styles.link}>
              <IconUser style={{ minWidth: "24px" }} aria-hidden="true" />
              {t("components:sidebar.my_profile")}
            </Link>
            :
            <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <IconUserPlus style={{ minWidth: "24px" }} aria-hidden="true" />
              {t("components:sidebar.create_account")}
            </Link>
          }
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <IconHome style={{ minWidth: "24px" }} aria-hidden="true" />
              {t("components:sidebar.home")}
            </Link>

            <PopoverButton
              anchorName='--create-popover-button'
              popoverTarget='create-popover'
              className='transparent rounded flex gap-50 font-weight-500 align-items-center width-100'
              style={{ fontSize: '1rem', overflow: 'hidden' }}
            >
              <IconCirclePlus aria-hidden="true" style={{ minWidth: '24px' }} />
              {t("components:sidebar.create")}
            </PopoverButton>
            <Popover
              id='create-popover'
              popover='auto'
              positionAnchor='--create-popover-button'
              anchorInlinePosition='end'
              popoverDirection={{ vertical: 'down' }}
              className='margin-inline-0'
              margin={{left: '2rem'}}
              indicator
            >
              <nav className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
                <div className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between alignt-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                  <span className='font-weight-600'>{t("components:sidebar.create")}</span>
                  <button popoverTarget='create-popover' className='transparent grid padding-25 round'>
                    <IconX role='img' aria-label={t("components:sidebar.close_menu_create_alt")} width={16} height={16} />
                  </button>
                </div>
                <Link href='/metaRoadmap/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                  {t("common:roadmap_series_one")}
                  <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
                </Link>
                <Link href='/roadmap/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                  {t("common:roadmap_short_one")}
                  <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
                </Link>
                <Link href='/goal/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                  {t("common:goal_one")}
                  <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
                </Link>
                <Link href='/action/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                  {t("common:action_one")}
                  <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
                </Link>
                <Link href='/effect/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                  {t("common:effect_one")}
                  <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
                </Link>
              </nav>
            </Popover>
          </div>

          <section>
            <PopoverButton
              anchorName='--select-language-popover-button'
              popoverTarget='select-language-popover'
              className='transparent rounded flex gap-50 font-weight-500 align-items-center width-100'
              style={{ fontSize: '1rem', overflow: 'hidden' }}
              data-testid="language-switcher-dialog-button"
            >
              <IconWorld aria-hidden="true" style={{ minWidth: '24px' }} />
              {t("components:sidebar.language")}
            </PopoverButton>
            <Popover
              id='select-language-popover'
              popover='auto'
              positionAnchor='--select-language-popover-button'
              anchorInlinePosition='end'
              popoverDirection={{ vertical: 'up' }}
              margin={{left: '2rem'}}
              indicator
            >
              <div className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
                <div className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between alignt-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                  <span className='font-weight-600'>{t("components:sidebar.language_alt")}</span>
                  <button popoverTarget='select-language-popover' className='transparent grid padding-25 round'>
                    <IconX role='img' aria-label={t("components:sidebar.close_menu_choose_language_alt")} width={16} height={16} />
                  </button>
                </div>
                <fieldset className={`fieldset-unset-pseudo-class`}>
                  <LanguageSwitcher />
                </fieldset>
              </div>
            </Popover> 

            <Link href="/info" className={`${styles.link} margin-top-300`}>
              <IconInfoCircle style={{ minWidth: "24px" }} aria-hidden="true" />
              {t("components:sidebar.about")}
            </Link>
          </section>
          {user?.isLoggedIn ?
            <LogoutButton />
            :
            <Link href="/login" className={styles.link}>
              <IconLogin2 style={{ minWidth: "24px" }} aria-hidden="true" />
              {t("common:tsx.login")}
            </Link>
          }
        </nav>
      </aside>
    </aside>
  </>
}
