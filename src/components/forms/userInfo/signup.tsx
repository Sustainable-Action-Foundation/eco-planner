'use client'

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import styles from '../forms.module.css'
import dict from "./signup.dict.json" assert { type: "json" };
import { useClientLocale } from "@/functions/clientLocale";
import { Locale } from "@/types";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>, locale: Locale) {
  event.preventDefault()

  const form = event.target
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
      res.json().then((data) => {
        alert(`${dict.handleSubmit.signupFailedForReason[locale]}${data.message}`)
      })
    }
  }).catch(() => {
    alert(dict.handleSubmit.signupFailed[locale])
  })
}

export default function Signup() {
  const locale = useClientLocale();

  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <form onSubmit={(event: React.ChangeEvent<HTMLFormElement>) => handleSubmit(event, locale)} className={`${styles.padding}`}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-90)' }}>{dict.signup.title[locale]}</h1>
        <label className="block margin-block-100">
          {dict.signup.username.label[locale]}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/user.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="text" placeholder={dict.signup.username.placeholder[locale]} name="username" required id="username" autoComplete="username" />
          </div>
        </label>
        <label className="block margin-block-100">
          {dict.signup.email.label[locale]}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="email" placeholder={dict.signup.email.placeholder[locale]} name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <label className="block margin-block-100">
          {dict.signup.password.label[locale]}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/password.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={dict.signup.password.placeholder[locale]} name="password" required id="password" autoComplete="new-password" />
            <button type="button" className={`${styles.showPasswordButton} grid padding-0 transparent`} onClick={() => setShowPassword(prevState => !prevState)}>
              <Image src={showPassword ? '/icons/eyeDisabled.svg' : '/icons/eye.svg'} alt="" width={24} height={24} />
            </button>
          </div>
        </label>

        <input value={dict.signup.submit.createAccount[locale]} className="block margin-top-200 smooth font-weight-bold seagreen color-purewhite" type="submit" />
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {dict.signup.haveAnAccount.label[locale]} <Link href='/login'>{dict.signup.haveAnAccount.login[locale]}</Link>
        </p>
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {dict.signup.information[locale]} <Link href='mailto:kontakt@sustainable-action.org'>kontakt@sustainable-action.org</Link>
        </p>

      </form>
    </>
  )
}