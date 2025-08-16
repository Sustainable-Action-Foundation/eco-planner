'use client'

import Link from "next/link";
import { useState } from "react";
import styles from '../forms.module.css'
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import { IconEye, IconEyeOff, IconLock, IconUser } from "@tabler/icons-react";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>, t: TFunction) {
  event.preventDefault()

  const form = event.target
  const formJSON = JSON.stringify({
    username: form.username?.value,
    password: form.password?.value,
    remember: (form.remember as HTMLInputElement | null)?.checked,
  })

  // Try to login, redirect away if successful.
  fetch('/api/login', {
    method: 'POST',
    body: formJSON,
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => {
    if (res.ok) {
      // Redirect to the page the user came from, or to the home page.
      const from = new URLSearchParams(window.location.search).get('from')
      if (from) {
        window.location.href = from
      } else {
        window.location.href = '/'
      }
    } else {
      alert(t("components:login.login_failed"))
    }
  }).catch(() => {
    alert(t("components:login.login_failed"))
  })
}

export default function Login() {
  const { t } = useTranslation(["components", "common"]);

  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <form onSubmit={(event: React.ChangeEvent<HTMLFormElement>) => handleSubmit(event, t)} className={`${styles.padding}`}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid silver' }}>{t("common:tsx.login")}</h1>

        <label className="block margin-block-100">
          {t("components:login.username")}
          <div className="margin-block-50 padding-50 flex align-items-center smooth focusable">
            <IconUser style={{minWidth: '24px'}} aria-hidden="true" />
            <input className="padding-0 margin-inline-50" type="text" placeholder={t("common:placeholder.name")} name="username" required id="username" autoComplete="username" />
          </div>
        </label>

        {/* TODO: This label is currently invalid due to multiple nested inputs (Similar invalid labels may exist elsewhere) */}
        <label className="block margin-block-100">
          {t("components:login.password")}
          <div className="margin-block-50 padding-50 flex align-items-center smooth focusable">
            <IconLock style={{minWidth: '24px'}} aria-hidden="true" />
            <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={t("common:placeholder.password")} name="password" required id="password" autoComplete="current-password" />
            <button 
              type="button" 
              className={`${styles.showPasswordButton} grid padding-0 transparent`} 
              onClick={() => setShowPassword(prevState => !prevState)}
              aria-label={showPassword ? 'hide password' : 'show password'}  
            >
              {showPassword ? <IconEyeOff style={{minWidth: '24px'}} aria-hidden="true" /> : <IconEye style={{minWidth: '24px'}} aria-hidden="true" />  } 
            </button>
          </div>
        </label>

        <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between">
          <label className="flex align-items-center gap-50">
            <input type="checkbox" name="remember" id="remember" />
            {t("components:login.remember_me")}
          </label>

          <small><Link href='/password'>{t("components:login.forgot_password")}</Link></small>

        </div>

        <input type="submit" value={t("common:tsx.login")} className="block font-weight-bold seagreen smooth color-purewhite margin-top-200" />

        <div className="flex gap-100 align-items-center justify-content-space-between alignt-items-center flex-wrap-wrap margin-block-100">
          <span>{t("components:login.no_account")} <Link href='/signup'>{t("components:login.create_account")}</Link></span>
          <Link href='/verify'>{t("components:login.verify_account")}</Link>
        </div>


      </form>
    </>
  )
}