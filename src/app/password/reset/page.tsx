'use client';

import Image from "next/image";
import { useState } from "react";
import styles from "@/components/forms/forms.module.css";
import formSubmitter from "@/functions/formSubmitter";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  event.preventDefault()

  const form = event.target
  const newPassword = form.password.value

  const params = new URLSearchParams(window.location.search)
  const email = params.get('email')
  const hash = params.get('hash')

  formSubmitter('/api/resetPassword', JSON.stringify({ email, hash, newPassword }), 'PATCH')
}

export default function Page() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      <Breadcrumb customSections={['Uppdatera lösenord']} />

      <div>
        <p>Fyll i ditt nya lösenord nedan och klicka på knappen för att uppdatera ditt lösenord.</p>
        <form onSubmit={handleSubmit}>
          <label className="block margin-block-100">
            Lösenord
            <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
              <Image src="/icons/password.svg" alt="" width={24} height={24} />
              <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder="lösenord" name="password" required id="password" autoComplete="current-password" />
              <button type="button" className={`${styles.showPasswordButton} grid padding-0 transparent`} onClick={() => setShowPassword(prevState => !prevState)}>
                <Image src={showPassword ? '/icons/eyeDisabled.svg' : '/icons/eye.svg'} alt="" width={24} height={24} />
              </button>
            </div>
          </label>
          <button type="submit">Byt lösenord</button>
        </form>
      </div>
    </>
  )
}