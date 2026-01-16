'use client'

import Link from "next/link";
import { useState } from "react";
import styles from '../forms.module.css'
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { IconEye, IconEyeOff, IconLock, IconMail, IconUser } from "@tabler/icons-react";
import { JSONValue } from "@/types";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>, t: TFunction) {
  event.preventDefault()

  const form = event.target
  if (!(form.username instanceof HTMLInputElement) || !(form.email instanceof HTMLInputElement) || !(form.password instanceof HTMLInputElement)) {
    return;
  }
  const formJSON = JSON.stringify({
    username: form.username.value,
    email: form.email?.value,
    password: form.password?.value,
    remember: (form.remember as HTMLInputElement | null)?.checked
  })

  // Try to signup, redirect to page informing user to verify email if successful.
  fetch('/api/signup', {
    method: 'POST',
    body: formJSON,
    headers: { 'Content-Type': 'application/json' },
  }).then((res) => {
    if (res.ok) {
      window.location.href = '/verify'
    } else {
      (res.json() as Promise<JSONValue>).then((data) => {
        if (data instanceof Object && "message" in data) {
          alert(t("components:signup.signup_failed_motivated", { reason: data.message }))
        }
      }).catch(() => {
        alert(t("components:signup.signup_failed"))
      })
    }
  }).catch(() => {
    alert(t("components:signup.signup_failed"))
  })
}

export default function Signup() {
  const { t } = useTranslation(["components", "common"]);

  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <form onSubmit={(event: React.ChangeEvent<HTMLFormElement>) => handleSubmit(event, t)} className={`${styles.padding}`}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid silver' }}>{t("components:signup.create_account")}</h1>
        <label>
          {t("components:signup.username")}
          <div className="margin-top-50 margin-bottom-100 padding-50 flex align-items-center smooth focusable">
            <IconUser style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50 font-size-100" type="text" placeholder={t("common:placeholder.name")} name="username" required id="username" autoComplete="username" />
          </div>
        </label>
        <label>
          {t("components:signup.email")}
          <div className="margin-top-50 margin-bottom-100 padding-50 flex align-items-center smooth focusable">
            <IconMail style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50 font-size-100" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <label>
          {t("components:signup.password")}
          <div className="margin-top-50 margin-bottom-100 padding-50 flex align-items-center smooth focusable">
            <IconLock style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50 transparent font-size-100" type={showPassword ? 'text' : 'password'} placeholder={t("common:placeholder.password")} name="password" required id="password" autoComplete="new-password" />
            <button
              type="button"
              className={`${styles.showPasswordButton} grid padding-0 transparent`}
              onClick={() => setShowPassword(prevState => !prevState)}
              aria-label={showPassword ? 'hide password' : 'show password'}
            >
              {showPassword ? <IconEyeOff style={{ minWidth: '24px' }} aria-hidden="true" /> : <IconEye style={{ minWidth: '24px' }} aria-hidden="true" />}
            </button>
          </div>
        </label>
        <div className="margin-top-300 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100  font-weight-600"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
           >
            {t("components:signup.create_account")}
          </button>
        </div>
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {t("components:signup.already_have_account")} <Link href='/login'>{t("common:tsx.login")}</Link>
        </p>
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {t("components:signup.disclaimer")} <Link href='mailto:kontakt@sustainable-action.org'>kontakt@sustainable-action.org</Link>
        </p>

      </form>
    </>
  )
}