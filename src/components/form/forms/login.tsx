'use client';

import Link from "next/link";
import { useState } from "react";
import styles from '../forms.module.css';
import { useTranslation } from "react-i18next";
import { IconExclamationCircle, IconMail, IconMailCheck } from "@tabler/icons-react";

/**
 * The one way in: an email address gets a one-time login link (POST /api/login-link).
 * The same form serves `/login` and `/signup`; only the copy differs, since an account
 * is created when a link for an allowlisted address is redeemed for the first time.
 */
export default function Login({ variant = "login" }: { variant?: "login" | "signup" }) {
  const { t } = useTranslation(["components", "common"]);

  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Prefilled when the user comes back from the "sent" panel */
  const [lastEmail, setLastEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<number>(0);

  function fail(message: string) {
    setErrorKey(prevKey => prevKey + 1);
    setErrorMessage(message);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form.email instanceof HTMLInputElement)) {
      return;
    }
    const email = form.email.value.trim();
    setLastEmail(email);
    setSubmitting(true);
    setErrorMessage(null);

    fetch('/api/login-link', {
      method: 'POST',
      body: JSON.stringify({
        email,
        remember: (form.remember as HTMLInputElement | null)?.checked === true,
        // Where the proxy sent us from (e.g. /roadmap/create); the link redeems back there
        from: new URLSearchParams(window.location.search).get('from'),
      }),
      headers: { 'Content-Type': 'application/json' },
    }).then((res) => {
      if (res.ok) {
        setSentTo(email);
      } else {
        // Only a malformed address is refused; everything else gets the same generic 200
        fail(t("components:login.invalid_email"));
      }
    }).catch(() => {
      fail(t("components:login.login_failed"));
    }).finally(() => setSubmitting(false));
  }

  const title = variant === "signup" ? t("components:signup.create_account") : t("common:tsx.login");

  if (sentTo) {
    return (
      <section className={styles.padding} data-testid="login-link-sent">
        <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid silver' }}>{title}</h1>
        <div className="flex gap-100 align-items-flex-start margin-block-100">
          <IconMailCheck style={{ minWidth: '24px' }} aria-hidden="true" />
          <div>
            <p className="margin-top-0" role="status">{t("components:login.link_sent", { email: sentTo })}</p>
            <p>{t("components:login.link_sent_hint")}</p>
          </div>
        </div>
        <button type="button" className="transparent padding-0 font-size-100" style={{ textDecoration: 'underline' }} onClick={() => setSentTo(null)}>
          {t("components:login.other_address")}
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.padding}>
      <h1 className="padding-bottom-100" style={{ borderBottom: '1px solid silver' }}>{title}</h1>

      <p>{variant === "signup" ? t("components:signup.description") : t("components:login.description")}</p>

      <label>
        {t("components:login.email")}
        <div className="margin-top-50 margin-bottom-100 padding-50 flex align-items-center smooth focusable">
          <IconMail style={{ minWidth: '24px' }} aria-hidden="true" />
          <input className="padding-0 margin-inline-50 font-size-100" type="email" placeholder={t("common:placeholder.email")} name="email" required={true} id="email" autoComplete="email" defaultValue={lastEmail} />
        </div>
      </label>

      <label className="flex align-items-center gap-50">
        <input type="checkbox" name="remember" id="remember" />
        {t("components:login.remember_me")}
      </label>

      <div className={`${styles["login-error-message"]} flex flex-direction-column-reversed rounded margin-block-75 padding-75 ${errorMessage ? "opacity-1" : "opacity-0"}`}
        key={errorKey} data-testid="login-error-message">
        <IconExclamationCircle width={24} height={24} aria-hidden="true" className="margin-right-50" />
        <p style={{ minHeight: "1.5rem" }} className="margin-0" role="alert" aria-hidden={!errorMessage}>
          {errorMessage}
        </p>
      </div>

      <div className="padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
        <button
          className="text-align-center seagreen color-purewhite width-100 font-weight-600"
          style={{ fontSize: '14px', transform: 'none' }}
          type="submit"
          id="submit-button"
          disabled={submitting}
        >
          {t("components:login.send_link")}
        </button>
      </div>

      {variant === "signup" ?
        <>
          <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
            {t("components:signup.already_have_account")} <Link href='/login'>{t("common:tsx.login")}</Link>
          </p>
          <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
            {t("components:signup.disclaimer")} <Link href='mailto:kontakt@sustainable-action.ngo'>kontakt@sustainable-action.ngo</Link>
          </p>
        </>
        :
        <p className="text-align-center padding-block-50 margin-bottom-100 margin-top-0">
          {t("components:login.no_account")} <Link href='/signup'>{t("components:login.create_account")}</Link>
        </p>
      }
    </form>
  );
}
