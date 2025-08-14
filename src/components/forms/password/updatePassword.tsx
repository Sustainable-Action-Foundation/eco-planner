'use client';

import formSubmitter from "@/functions/formSubmitter"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import styles from "@/components/forms/forms.module.css";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";

export default function UpdatePassword() {
  const { t } = useTranslation(["pages", "common"]);

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target;
    if (!(form.password instanceof HTMLInputElement)) {
      return;
    }
    const newPassword = form.password.value;

    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const hash = params.get('hash');

    formSubmitter('/api/resetPassword', JSON.stringify({ email, hash, newPassword }), 'PATCH', t);
  }

  const [showPassword, setShowPassword] = useState(false)

  return (
    <form onSubmit={handleSubmit}>
      <label className="block margin-block-100">
        {t("pages:password_reset.password")}
        <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
          <IconLock style={{ minWidth: '24px' }} aria-hidden="true" />
          <input className="padding-0 margin-inline-50 transparent" type={showPassword ? 'text' : 'password'} placeholder={t("common:placeholder.password")} name="password" required id="password" autoComplete="current-password" />
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
      <button type="submit" className="block margin-left-auto">{t("pages:password_reset.submit")}</button>
    </form>
  )
}