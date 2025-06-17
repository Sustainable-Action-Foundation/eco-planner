"use server";

import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { LanguageSwitcher } from "@/components/languageSwitcher"
import serveTea from "@/lib/i18nServer";
import { PopoverButton, Popover } from '@/components/generic/popovers/popovers';
import { IconCirclePlus, IconHome, IconInfoCircle, IconLogin2, IconLogout, IconLogout2, IconMenu2, IconPlus, IconSettings, IconUser, IconUserPlus, IconWorld, IconX } from '@tabler/icons-react'

export default async function Sidebar() {
  const [t, { user }] = await Promise.all([
    serveTea(["components", "common"]),
    getSession(await cookies()),
  ]);

  return <>

    <aside className={`${styles["aside"]} inline-flex flex-direction-column`}>
      <label className='margin-100 padding-25' aria-label="open/close menu" style={{ width: 'fit-content', marginLeft: 'calc(1rem + 4px)' }}>
        <input type="checkbox" className="none" />
        {/* TODO SIDENAV: I18n for all aria-labels */}
        <IconMenu2 aria-hidden="true" height={24} width={24} className='grid' style={{ minWidth: '24px' }} />
      </label>

      <div className='padding-100 flex-grow-100 flex flex-direction-column'>
        <nav className='flex-grow-100 flex flex-direction-column'>
          {/* TODO SIDENAV: check if more svg's (globally) accidentally use maxWidth instead of minWidth  */}
          {/* TODO SIDENAV: Is the usage of nav correct if theres more than links?  */}
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className="flex align-items-center margin-bottom-300" style={{ gap: "10px" }}>
              <IconUser aria-hidden='true' height={20} width={20} style={{ marginLeft: "2px", minWidth: '20px' }} />
              {t("components:sidebar.my_profile")}
            </Link>
            :
            <Link href="/signup" className='flex align-items-center margin-bottom-300 seagreen color-purewhite round padding-50 text-decoration-none' style={{ gap: '10px', paddingRight: "calc(.5rem + 10px)" }}>
              {/* TODO: Padding-right fix for all links? */}
              <IconUserPlus aria-hidden='true' height={20} width={20} style={{ minWidth: "24px" }} />
              {t("components:sidebar.create_account")}
            </Link>
          }

          <Link href="/" className="flex align-items-center" style={{ gap: "10px" }}>
            <IconHome aria-hidden='true' height={20} width={20} style={{ marginLeft: "2px", minWidth: '20px' }} />
            {t("components:sidebar.home")}
          </Link>
          <PopoverButton
            anchorName='--create-popover-button'
            popoverTarget='create-popover'
            className='transparent rounded flex align-items-center width-100'
            style={{ gap: '10px', fontSize: '1rem', overflow: 'hidden' }}
          >
            <IconCirclePlus width={20} height={20} aria-hidden="true" style={{ marginLeft: "2px", minWidth: '20px' }} />
            {t("components:sidebar.create")}
          </PopoverButton>
          <Popover
            id='create-popover'
            popover='auto'
            positionAnchor='--create-popover-button'
            anchorInlinePosition='end'
            popoverDirection={{ vertical: 'down' }}
            className='margin-inline-0'
            margin={{ left: '2rem' }}
            indicator
          >
            <nav className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver', fontSize: '.8rem' }}>
              <header className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                <h2 className='font-weight-600 margin-0' style={{ fontSize: 'inherit' }}>{t("components:sidebar.create")}</h2>
                {/* TODO: I18n */}
                <button popoverTarget='create-popover' aria-label='Stäng meny: skapa' className='transparent grid padding-25 round'>
                  <IconX aria-hidden='true' width={16} height={16} />
                </button>
              </header>
              {/* TODO SIDENAV: Does this need to be a list? */}
              <ul className='padding-0 margin-0' style={{ listStyle: 'none' }}>
                <li>
                  <Link href='/metaRoadmap/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                    {t("common:roadmap_series_one")}
                    <IconPlus width={16} height={16} style={{ minWidth: '16px' }} />
                  </Link>
                </li>
                <li>
                  <Link href='/roadmap/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                    {t("common:roadmap_short_one")}
                    <IconPlus width={16} height={16} style={{ minWidth: '16px' }} />
                  </Link>
                </li>
                <li>
                  <Link href='/goal/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                    {t("common:goal_one")}
                    <IconPlus width={16} height={16} style={{ minWidth: '16px' }} />
                  </Link>
                </li>
                <li>
                  <Link href='/action/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                    {t("common:action_one")}
                    <IconPlus width={16} height={16} style={{ minWidth: '16px' }} />
                  </Link>
                </li>
                <li>
                  <Link href='/effect/create' className={`${styles['menu-link']} text-transform-capitalize flex align-items-center justify-content-space-between gap-100 padding-25 smooth color-pureblack text-decoration-none`}>
                    {t("common:effect_one")}
                    <IconPlus width={16} height={16} style={{ minWidth: '16px' }} />
                  </Link>
                </li>
              </ul>
            </nav>
          </Popover>
          <Link href="/info" className="flex align-items-center margin-top-auto" style={{ gap: "10px", fontSize: '1rem' }}>
            <IconInfoCircle aria-hidden='true' height={20} width={20} style={{ marginLeft: "2px", minWidth: '20px' }} />
            {t("components:sidebar.about")}
          </Link>
        </nav>
        <div className="margin-top-300" style={{ fontSize: '.8rem' }}>
          {/* TODO SIDENAV: Buttons: .8rem, Links, 1rem */}
          {/* TODO SIDENAV: Consistent hover behavior between links and buttons */}
          <PopoverButton
            anchorName='--select-language-popover-button'
            popoverTarget='select-language-popover'
            className='transparent rounded flex align-items-center width-100'
            style={{ gap: '10px', fontSize: '.8rem' }}
          >
            <IconWorld aria-hidden="true" width={20} height={20} style={{ marginLeft: "2px", minWidth: '20px' }} />
            {t("components:sidebar.language")}
          </PopoverButton>
          <Popover
            id='select-language-popover'
            popover='auto'
            positionAnchor='--select-language-popover-button'
            anchorInlinePosition='end'
            popoverDirection={{ vertical: 'up' }}
            margin={{ left: '2rem' }}
            indicator
          >
            {/* TODO SIDENAV: accessibility, Fieldset is a group nested within a group? */}
            <fieldset className='padding-25 smooth fieldset-unset-pseudo-class' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
              <div className='padding-bottom-25 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center' style={{ borderBottom: '1px solid var(--gray)' }}>
                <legend className='font-weight-600'>{t("components:sidebar.language_alt")}</legend>
                {/* TODO SIDENAV: i18n */}
                <button popoverTarget='select-language-popover' aria-label='Stäng meny: välj språk' className='transparent grid padding-25 round'>
                  <IconX aria-hidden='true' width={16} height={16} />
                </button>
              </div>
              <LanguageSwitcher />
            </fieldset>
          </Popover>
          {/* TODO: Should be a settings menu */}
          <Link href="" className="flex align-items-center" style={{ gap: "10px" }}>
            <IconSettings aria-hidden='true' height={20} width={20} style={{ marginLeft: "2px", minWidth: '20px' }} />
            {t("components:sidebar.settings")}
          </Link>
        </div>
        <div className="padding-top-100 margin-top-100" style={{ borderTop: "1px solid silver", fontSize: '.8rem' }}>
          {user?.isLoggedIn ?
            <LogoutButton />
            :
            <Link href="/login" className="flex align-items-center justify-content-flex-end" style={{ gap: "10px", padding: '.5rem' }}>
              <div className="flex-grow-100" style={{ marginLeft: "2px", textAlign: "left" }}>{t("common:tsx.login")}</div>
              <IconLogin2 aria-hidden='true' height={20} width={20} style={{ marginRight: "2px", minWidth: '20px' }} />
            </Link>
          }
        </div>
      </div>
    </aside>
  </>
}
