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

            {/* TODO: i18n */}
            <PopoverButton
              anchorName='--create-popover-button'
              popoverTarget='create-popover'
              className='transparent rounded flex gap-50 font-weight-600 align-items-center width-100'
              style={{ fontSize: '1rem', overflow: 'hidden' }}
            >
              <IconCirclePlus aria-hidden="true" style={{ minWidth: '24px' }} />
              Skapa
            </PopoverButton>
            <Popover
              id='create-popover'
              popover='auto'
              positionAnchor='--create-popover-button'
              anchorInlinePosition='end'
              popoverDirection={{ vertical: 'down' }}
              className='margin-left-200'
            >
              <nav className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
                <div className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between alignt-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                  <span className='font-weight-600'>Skapa</span>
                  <button popoverTarget='create-popover' className='transparent grid padding-25 round'>
                    <IconX role='img' aria-label='Stäng meny: skapa' width={16} height={16} />
                  </button>
                </div>
                <Link href='/metaRoadmap/create' className={`${styles['menu-link']} flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none`}>
                  Färdplansserie
                  <IconPlus width={16} height={16} />
                </Link>
                <Link href='/roadmap/create' className={`${styles['menu-link']} flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none`}>
                  Färdplan
                  <IconPlus width={16} height={16} />
                </Link>
                <Link href='/goal/create' className={`${styles['menu-link']} flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none`}>
                  Målbana
                  <IconPlus width={16} height={16} />
                </Link>
                <Link href='/action/create' className={`${styles['menu-link']} flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none`}>
                  Åtgärd
                  <IconPlus width={16} height={16} />
                </Link>
                <Link href='/effect/create' className={`${styles['menu-link']} flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none`}>
                  Effekt
                  <IconPlus width={16} height={16} />
                </Link>
              </nav>
            </Popover>
          </div>

          <section>
            {/* TODO: i18n */}
            <PopoverButton
              anchorName='--select-language-popover-button'
              popoverTarget='select-language-popover'
              className='transparent rounded flex gap-50 font-weight-600 align-items-center width-100'
              style={{ fontSize: '1rem', overflow: 'hidden' }}
            >
              <IconWorld aria-hidden="true" style={{ minWidth: '24px' }} />
              Språk
            </PopoverButton>
            <Popover
              id='select-language-popover'
              popover='auto'
              positionAnchor='--select-language-popover-button'
              anchorInlinePosition='end'
              popoverDirection={{ vertical: 'up' }}
            >
              <div className='padding-25 smooth margin-left-200' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
                <div className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between alignt-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                  <span className='font-weight-600'>Välj språk</span>
                  <button popoverTarget='create-popover' className='transparent grid padding-25 round'>
                    <IconX role='img' aria-label='Stäng meny: välj språk' width={16} height={16} />
                  </button>
                </div>
                <fieldset className={`fieldset-unset-pseudo-class`}>
                  <LanguageSwitcher />
                </fieldset>
              </div>
            </Popover> 

            {/* TODO: i18n */}
            {/* TODO: Actually fill menu */}
            {/*
            <PopoverButton 
              anchorName='--settings-dialog-button' 
              popoverTarget='settings-dialog-popover'                
              className='transparent rounded flex gap-50 font-weight-600 align-items-center width-100' 
              style={{fontSize: '1rem', overflow: 'hidden' }}
            >
              <IconSettings aria-hidden="true" style={{minWidth: '24px'}} />
              Inställningar
            </PopoverButton>
            <Popover 
              id='settings-dialog-popover' 
              popover='auto' 
              anchorInlinePosition='end' 
              popoverDirection={{vertical: 'up'}} 
            >
              <div className='padding-25 smooth margin-left-200' style={{backgroundColor: 'white', border: '1px solid silver'}}>
                <div className='padding-bottom-25 margin-bottom-25 flex gap-300 justify-content-space-between alignt-items-center' style={{borderBottom: '1px solid silver'}}>
                  <span className='font-weight-600'>Inställningar</span>
                  <button popoverTarget='settings-dialog-popover' className='transparent grid padding-25 round'>
                    <IconX role='img' aria-label='Stäng meny: inställningar' width={16} height={16} />
                  </button>
                </div>
              </div>
            </Popover>
           */}

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
