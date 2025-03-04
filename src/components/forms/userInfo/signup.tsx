"use client"

import Link from "next/link";
import Image from "next/image";
import { useContext, useState } from "react";
import styles from '../forms.module.css'
import { createDict } from "../forms.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx";
import { Locale } from "@/types";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>, locale: Locale) {
  const dict = createDict(locale).userInfo.signup;
  event.preventDefault();

  const form = event.target;
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
        alert(`${dict.handleSubmit.signupFailedForReason}${data.message}`);
      })
    }
  }).catch(() => {
    alert(dict.handleSubmit.signupFailed);
  })
}

export default function Signup() {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).userInfo.signup;

  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <form onSubmit={(event: React.ChangeEvent<HTMLFormElement>) => handleSubmit(event, locale)} className={`${styles.padding}`}>
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-90)' }}>{dict.signup.title}</h1>
        <label className="block margin-block-100">
          {dict.signup.username.label}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/user.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="text" placeholder={dict.signup.username.placeholder} name="username" required id="username" autoComplete="username" />
          </div>
        </label>
        <label className="block margin-block-100">
          {dict.signup.email.label}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/email.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50" type="email" placeholder={dict.signup.email.placeholder} name="email" required id="email" autoComplete="email" />
          </div>
        </label>
        <label className="block margin-block-100">
          {dict.signup.password.label}
          <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
            <Image src="/icons/password.svg" alt="" width={24} height={24} />
            <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={dict.signup.password.placeholder} name="password" required id="password" autoComplete="new-password" />
            <button type="button" className={`${styles.showPasswordButton} grid padding-0 transparent`} onClick={() => setShowPassword(prevState => !prevState)}>
              <Image src={showPassword ? '/icons/eyeDisabled.svg' : '/icons/eye.svg'} alt="" width={24} height={24} />
            </button>
          </div>
        </label>

        <input value={dict.signup.submit.createAccount} className="block margin-top-200 smooth font-weight-bold seagreen color-purewhite" type="submit" />
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {dict.signup.haveAnAccount.label} <Link href='/login'>{dict.signup.haveAnAccount.login}</Link>
        </p>
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {dict.signup.information} <Link href='mailto:kontakt@sustainable-action.org'>kontakt@sustainable-action.org</Link>
        </p>

      </form>
    </>
  )
}