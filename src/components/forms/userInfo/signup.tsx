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
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-90)' }}>{t("components:signup.create_account")}</h1>
        <label className="block margin-block-100">
          {t("components:signup.username")}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <IconUser style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50" type="text" placeholder={t("common:placeholder.name")} name="username" required id="username" autoComplete="username" />
          </div>
        </label>
        <label className="block margin-block-100">
          {t("components:signup.email")}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <IconMail style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <label className="block margin-block-100">
          {t("components:signup.password")}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <IconLock style={{ minWidth: '24px' }} aria-hidden="true" />
            <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={t("common:placeholder.password")} name="password" required id="password" autoComplete="new-password" />
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

        <input value={t("components:signup.create_account")} className="block margin-top-200 smooth font-weight-bold seagreen color-purewhite" type="submit" />
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