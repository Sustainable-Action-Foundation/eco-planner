'use client'

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import styles from '../forms.module.css'
import dict from "./login.dict.json" assert { type: "json" };
import { Locale } from "@/types";
import { getClientLocale, validateDict } from "@/functions/clientLocale";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>, locale: Locale) {
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
      alert(dict.handleSubmit.loginFailed[locale])
    }
  }).catch(() => {
    alert(dict.handleSubmit.loginFailed[locale])
  })
}

export default function Login() {
  validateDict(dict)
  const locale = getClientLocale()

  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <form onSubmit={(event: React.ChangeEvent<HTMLFormElement>) => handleSubmit(event, locale)} className={`${styles.padding}`}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-90)' }}>{dict.login.title[locale]}</h1>

        <label className="block margin-block-100">
          {dict.login.username.label[locale]}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/user.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="text" placeholder={dict.login.username.placeholder[locale]} name="username" required id="username" autoComplete="username" />
          </div>
        </label>

        <label className="block margin-block-100">
          {dict.login.password.label[locale]}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/password.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={dict.login.password.placeholder[locale]} name="password" required id="password" autoComplete="current-password" />
            <button type="button" className={`${styles.showPasswordButton} grid padding-0 transparent`} onClick={() => setShowPassword(prevState => !prevState)}>
              <Image src={showPassword ? '/icons/eyeDisabled.svg' : '/icons/eye.svg'} alt="" width={24} height={24} />
            </button>
          </div>
        </label>

        <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between">
          <label className="flex align-items-center gap-50">
            <input type="checkbox" name="remember" id="remember" />
            {dict.login.rememberMe[locale]}
          </label>

          <small><Link href='/password'>{dict.login.forgotPassword[locale]}</Link></small>

        </div>

        <input type="submit" value={dict.login.submit.login[locale]} className="block font-weight-bold seagreen smooth color-purewhite margin-top-200" />

        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {dict.login.noAccount.label[locale]} <Link href='/signup'>{dict.login.noAccount.createAccount[locale]}</Link> <br />
          <Link href='/verify'>{dict.login.noAccount.verifyAccount[locale]}</Link> {/* TODO: Flytta denna till ens account page */}
        </p>


      </form>
    </>
  )
}