"use server";

import styles from './header.module.css' with { type: "css" }
import LogoutButton from '@/components/buttons/logoutButton'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { LanguageSwitcher } from "@/components/languageSwitcher"
import serveTea from "@/lib/i18nServer";
import NonModalDialog, { NonModalDialogButton, NonModalDialogTemp, NonModalDialogWrapper } from '@/components/generic/dialog/nonModalDialog';
// import Notifications from '../notifications/notification'
import { IconHome, IconInfoCircle, IconLogin2, IconMenu2, IconUser, IconUserPlus } from '@tabler/icons-react'

export default async function Sidebar() {
  const [t, { user }] = await Promise.all([
    serveTea(["components", "common"]),
    getSession(await cookies()),
  ]);

  return <>
    <aside className={styles.container}>
      <label className={styles.menuToggleContainer}>
        <input type="checkbox" className={styles.menuToggle} />
        <IconMenu2 role='img' aria-label={t("components:sidebar.toggle_menu_alt")}  />
      </label>
      <aside className={`${styles.aside} flex-grow-100`}>
        <nav className={styles.nav}>
          {user?.isLoggedIn ?
            <Link href={`/@${user.username}`} className={styles.link}>
              <IconUser style={{minWidth: "24px"}} aria-hidden="true" />
              {t("components:sidebar.my_profile")}
            </Link>
            :
            <Link href="/signup" className='flex gap-50 align-items-center padding-50 margin-block-25 round seagreen color-purewhite button font-weight-500' style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <IconUserPlus style={{minWidth: "24px"}} aria-hidden="true" />
              {t("components:sidebar.create_account")}
            </Link>
          }
          <div className='flex-grow-100'>
            <Link href="/" className={styles.link}>
              <IconHome style={{minWidth: "24px"}} aria-hidden="true" />
              {t("components:sidebar.home")}
            </Link>
            {/*
            <NonModalDialogWrapper>
              <NonModalDialogButton 
                id='create-dialog-button'
                indicatorMargin='1rem'
                dialogPosition='right'
                className='transparent rounded flex gap-50 font-weight-600 align-items-center width-100' 
                style={{fontSize: '1rem', overflow: 'hidden' }}
              > 
                <IconCirclePlus aria-hidden="true" style={{maxWidth: '24px'}} />
                Skapa
              </NonModalDialogButton>
              <NonModalDialogTemp>
                Skapa
              </NonModalDialogTemp>
            </NonModalDialogWrapper>
            */}
          </div>
          <section>
            <NonModalDialog
              dialogPosition='right'
              verticalAlign='top'
              title={t("components:sidebar.language_alt")}
              buttonTitle={t("components:sidebar.language")}
              toggleButtonWidth='100%'
              margin={{ top: '0', right: '0', bottom: '0', left: '2rem' }}
            >
              <fieldset className={`padding-inline-25 padding-bottom-25 fieldset-unset-pseudo-class`}>
                <LanguageSwitcher />
              </fieldset>
            </NonModalDialog>
            {/*
              <NonModalDialogWrapper>
                <NonModalDialogButton 
                  id='settings-dialog-button'
                  indicatorMargin='1rem'
                  dialogPosition='right'
                  className='transparent rounded flex gap-50 font-weight-600 align-items-center width-100' 
                  style={{fontSize: '1rem', overflow: 'hidden' }}
                >
                  <IconSettings aria-hidden="true"' style={{maxWidth: '24px'}} />
                  Inställningar
                </NonModalDialogButton>
                <NonModalDialogTemp>
                  Inställningar
                </NonModalDialogTemp>
              </NonModalDialogWrapper>
             */}
            <Link href="/info" className={`${styles.link} margin-top-300`}>
              <IconInfoCircle style={{minWidth: "24px"}} aria-hidden="true" />
              {t("components:sidebar.about")}
            </Link>
          </section>
          {user?.isLoggedIn ?
            <LogoutButton />
            :
            <Link href="/login" className={styles.link}>
              <IconLogin2 style={{minWidth: "24px"}} aria-hidden="true" />
              {t("common:tsx.login")}
            </Link>
          }
        </nav>
      </aside>
    </aside>
  </>
}
