'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { IconExclamationCircle } from "@tabler/icons-react";
import styles from '../forms.module.css';
import { nameMaxLength } from "@/functions/personName";
import { safeRedirectPath } from "@/functions/safeRedirectPath";
import { useToast } from "@/components/generic/toast/toastContext.use";

/**
 * First and last name of the signed-in user (PATCH /api/user). At first login it is
 * the onboarding step on /welcome, which continues to `redirectTo` once saved; on the
 * profile page it edits the name in place.
 */
export default function NameForm({ firstName, lastName, redirectTo }: {
  firstName?: string | null,
  lastName?: string | null,
  /** Where to go after saving; without it the form stays and confirms with a toast */
  redirectTo?: string,
}) {
  const { t } = useTranslation(["components", "common"]);
  const router = useRouter();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form.firstName instanceof HTMLInputElement) || !(form.lastName instanceof HTMLInputElement)) {
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: form.firstName.value, lastName: form.lastName.value }),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      if (redirectTo !== undefined) {
        router.push(safeRedirectPath(redirectTo));
      }
      else {
        addToast(t("components:name_form.saved"), "success");
      }
      router.refresh();
    }).catch(() => {
      setErrorMessage(t("components:name_form.failed"));
    }).finally(() => setSubmitting(false));
  }

  return (
    <form onSubmit={handleSubmit} data-testid="name-form">
      <div className="flex gap-100 flex-wrap-wrap">
        <label className="flex-grow-100">
          {t("components:name_form.first_name")}
          <input className="margin-top-25 block width-100" type="text" name="firstName" id="firstName" autoComplete="given-name" required={true} maxLength={nameMaxLength} defaultValue={firstName ?? ""} />
        </label>
        <label className="flex-grow-100">
          {t("components:name_form.last_name")}
          <input className="margin-top-25 block width-100" type="text" name="lastName" id="lastName" autoComplete="family-name" required={true} maxLength={nameMaxLength} defaultValue={lastName ?? ""} />
        </label>
      </div>

      {errorMessage ?
        <p role="alert" className={`${styles["login-error-message"]} flex align-items-center gap-50 rounded margin-block-75 padding-75`} data-testid="name-form-error">
          <IconExclamationCircle width={24} height={24} aria-hidden="true" />
          {errorMessage}
        </p>
        : null}

      <button type="submit" className="seagreen color-purewhite font-weight-600 margin-top-100" id="save-name" disabled={submitting}>
        {redirectTo !== undefined ? t("components:name_form.continue") : t("common:tsx.save")}
      </button>
    </form>
  );
}
