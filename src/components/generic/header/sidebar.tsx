import "server-only";
import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { LanguageSwitcher } from "@/components/languageSwitcher"
import serveTea from "@/lib/i18nServer";
import { PopoverButton, Popover } from '@/components/generic/popovers/popovers';
import { IconCirclePlus, IconHome, IconInfoCircle, IconLogin2, IconLogout2, IconMenu2, IconPlus, IconSettings, IconUser, IconUserPlus, IconWorld, IconX } from '@tabler/icons-react'
import GraphCookie from '@/components/cookies/graphCookie';

export default async function Sidebar() {
  const [t, { user }] = await Promise.all([
    serveTea(["components", "common"]),
    getSession(await cookies()),
  ]);

  return <>
    <aside className={`${styles["sidebar"]} inline-flex flex-direction-column`} style={{backgroundColor: '#fefefe'}}>
      {/* Consider using js + button instead of checkbox (or on top of using a checkbox) for accesability purposes */}
      {/* Consider adding infobubbles to items in the navbar */}
      <header>
        <label className='inline-grid round position-relative' aria-label={t("components:sidebar.toggle_menu_alt")}>
          <input type="checkbox" className={`${styles['sidebar-toggle']} position-absolute opacity-0`} defaultChecked />
          <IconMenu2 aria-hidden="true" />
        </label>
      </header>

      <div className={`${styles['sidebar-menu']} flex-grow-100 flex flex-direction-column`}>
        <nav className='flex-grow-100 flex flex-direction-column'>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className="margin-bottom-300 color-pureblack rounded">
              <IconUser aria-hidden='true' />
              {t("components:sidebar.my_profile")}
            </Link>
            :
            <Link href="/signup" className='margin-bottom-300 seagreen round color-purewhite'>
              <IconUserPlus aria-hidden='true' />
              {t("components:sidebar.create_account")}
            </Link>
          }

          <Link href="/" className='color-pureblack rounded'>
            <IconHome aria-hidden='true' />
            {t("components:sidebar.home")}
          </Link>
          <PopoverButton
            anchorName='--create-popover-button'
            popoverTarget='create-popover'
            className='transparent rounded'
            style={{ fontSize: '1rem' }}
          >
            <IconCirclePlus aria-hidden="true" />
            {t("components:sidebar.create")}
          </PopoverButton>
          <Popover
            id='create-popover'
            popover='auto'
            positionAnchor='--create-popover-button'
            anchorInlinePosition='end'
            popoverDirection={{ vertical: 'down' }}
            margin='1.5rem'
          >
            <nav className='padding-25 smooth' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
              <header
                className='padding-bottom-50 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center'
                style={{ borderBottom: '1px solid var(--gray)' }}
              >
                <h2 className='font-weight-600 margin-0' style={{ fontSize: 'inherit' }}>{t("components:sidebar.create")}</h2>
                <button popoverTarget='create-popover' aria-label={t("components:sidebar.close_menu_create")} className='transparent grid padding-25 round'>
                  <IconX aria-hidden='true' width={16} height={16} />
                </button>
              </header>
              <ul className='padding-0 margin-0' style={{ listStyle: 'none' }}>
                <li>
                  <Link href='/metaRoadmap/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                    {t("common:roadmap_series_one")}
                    <IconPlus width={16} height={16} />
                  </Link>
                </li>
                <li>
                  <Link href='/roadmap/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                    {t("common:roadmap_short_one")}
                    <IconPlus width={16} height={16} />
                  </Link>
                </li>
                <li>
                  <Link href='/goal/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                    {t("common:goal_one")}
                    <IconPlus width={16} height={16} />
                  </Link>
                </li>
                <li>
                  <Link href='/action/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                    {t("common:action_one")}
                    <IconPlus width={16} height={16} />
                  </Link>
                </li>
                <li>
                  <Link href='/effect/create' className='text-transform-capitalize flex align-items-center justify-content-space-between gap-300 padding-25 smooth color-pureblack text-decoration-none'>
                    {t("common:effect_one")}
                    <IconPlus width={16} height={16} />
                  </Link>
                </li>
              </ul>
            </nav>
          </Popover>
          <Link href="/info" className="margin-top-auto color-pureblack rounded">
            <IconInfoCircle aria-hidden='true' />
            {t("components:sidebar.about")}
          </Link>
        </nav>
        <div className="margin-top-300 font-size-smaller">
          <PopoverButton
            anchorName='--select-language-popover-button'
            popoverTarget='select-language-popover'
            className='transparent rounded'
            data-testid="language-switcher-dialog-button"
          >
            <IconWorld aria-hidden="true" />
            {t("components:sidebar.language")}
          </PopoverButton>
          {/* TODO: Update margins of the title/close section in all popovers once firefox supports anchor positions */}
          <Popover
            id='select-language-popover'
            popover='auto'
            positionAnchor='--select-language-popover-button'
            anchorInlinePosition='end'
            popoverDirection={{ vertical: 'up' }}
            margin='1.5rem'
          >
            <fieldset className='padding-25 smooth fieldset-unset-pseudo-class' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
              <div
                className='padding-bottom-50 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center'
                style={{ borderBottom: '1px solid var(--gray)' }}>
                <legend className='font-weight-600'>{t("components:sidebar.language_alt")}</legend>
                <button popoverTarget='select-language-popover' aria-label={t("components:sidebar.close_menu_language")} className='transparent grid padding-25 round'>
                  <IconX aria-hidden='true' width={16} height={16} />
                </button>
              </div>
              <LanguageSwitcher />
            </fieldset>
          </Popover>
          <PopoverButton
            anchorName='--settings-popover-button'
            popoverTarget='settings-popover'
            className='transparent rounded'
          >
            <IconSettings aria-hidden="true" />
            {t("components:sidebar.settings")}
          </PopoverButton>
          <Popover
            id='settings-popover'
            popover='auto'
            positionAnchor='--settings-popover-button'
            anchorInlinePosition='end'
            popoverDirection={{ vertical: 'up' }}
            margin='1.5rem'
          >
            <fieldset className='padding-25 smooth fieldset-unset-pseudo-class' style={{ backgroundColor: 'white', border: '1px solid silver' }}>
              <div
                className='padding-bottom-50 margin-bottom-25 margin-inline-25 flex gap-300 justify-content-space-between align-items-center'
                style={{ borderBottom: '1px solid var(--gray)' }}>
                <legend className='font-weight-600'>{t("components:sidebar.settings")}</legend>
                <button popoverTarget='settings-popover' aria-label={t("components:sidebar.close_menu_settings")} className='transparent grid padding-25 round'>
                  <IconX aria-hidden='true' width={16} height={16} />
                </button>
              </div>
              <GraphCookie className='margin-block-25 padding-50' style={{ width: '300px', gap: '.75rem' }} />
            </fieldset>
          </Popover>
        </div>
        <div className="padding-top-100 margin-top-100 font-size-smaller" style={{ borderTop: "1px solid silver" }}>
          { /*
            Logout/login button padding is given in css file,
            we overwrite this as the icon for theese buttons is on the right 
            instead of on the left as is the case with other menu items
          */ }
          {user?.isLoggedIn ?
            <LogoutButton className='justify-content-flex-end transparent rounded' style={{ paddingRight: '.5rem' }}>
              <div className="flex-grow-100 text-align-left">{t("common:tsx.logout")}</div>
              <IconLogout2 aria-hidden="true" />
            </LogoutButton>
            :
            <Link href="/login" className="justify-content-flex-end color-pureblack rounded" style={{ paddingRight: '.5rem' }}>
              <div className="flex-grow-100 text-align-left">{t("common:tsx.login")}</div>
              <IconLogin2 aria-hidden='true' />
            </Link>
          }
        </div>
      </div>
    </aside>
  </>
}
