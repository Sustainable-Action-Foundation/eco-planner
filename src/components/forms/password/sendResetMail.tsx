'use client';

import formSubmitter from "@/functions/formSubmitter"
import { useTranslation } from "react-i18next"
import { IconMail } from "@tabler/icons-react";

export default function SendResetMail() {
  const { t } = useTranslation(["pages", "common"]);

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target;
    if (form.email instanceof HTMLInputElement && typeof form.email.value === "string") {
      const emailAddress = form.email.value.trim();

      if (!emailAddress) {
        return;
      }

      // Send a new verification email
      formSubmitter('/api/sendReset', JSON.stringify({ email: emailAddress }), 'POST', t)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {t("pages:password.input_label")}
        <div className="margin-block-50 padding-50 flex align-items-center gray-90 smooth focusable">
          <IconMail />
          <input className="padding-0 margin-inline-50" type="email" placeholder={t("common:placeholder.email")} name="email" required id="email" autoComplete="email" />
        </div>
      </label>
      <button className="margin-left-auto block" type="submit">{t("pages:password.submit")}</button>
    </form>
  )
}