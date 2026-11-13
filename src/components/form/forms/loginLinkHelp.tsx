'use client';

import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { LoginLinkAnswer } from "@/lib/authToken";

/** The answer of POST /api/login-link, or null when it is not in the expected shape. */
export function parseLoginLinkAnswer(body: unknown): LoginLinkAnswer | null {
  const answer = body as Partial<LoginLinkAnswer> | null;
  if (
    !answer || typeof answer !== "object"
    || typeof answer.sentAt !== "string" || isNaN(Date.parse(answer.sentAt))
    || typeof answer.expiresAt !== "string" || isNaN(Date.parse(answer.expiresAt))
    || typeof answer.sender !== "string"
    || typeof answer.subjects?.login !== "string" || typeof answer.subjects.welcome !== "string"
  ) {
    return null;
  }
  return answer as LoginLinkAnswer;
}

/**
 * When the link was sent and how long it works, and a fold-out for when no mail arrives,
 * with a text to hand to IT support. Only ever rendered after a request made in the browser,
 * so the times are formatted in the browser's time zone without a hydration concern.
 * The text names both possible subject lines and never the link: the server answers the
 * same for every address, so this screen does not know which mail (if any) went out.
 */
export default function LoginLinkHelp({ email, answer }: { email: string, answer: LoginLinkAnswer }) {
  const { t } = useTranslation(["components"]);
  const [copied, setCopied] = useState(false);

  const sentAt = new Date(answer.sentAt);
  const expiresAt = new Date(answer.expiresAt);
  const { sender } = answer;

  const textValues = {
    date: sentAt,
    time: sentAt,
    loginSubject: answer.subjects.login,
    welcomeSubject: answer.subjects.welcome,
    email,
    formatParams: { date: { dateStyle: "long" }, time: { timeStyle: "medium" } },
  } as const;
  const itText = sender
    ? t("components:login.help_it_text", { ...textValues, sender })
    : t("components:login.help_it_text_no_sender", textValues);

  function copy() {
    navigator.clipboard.writeText(itText).then(() => setCopied(true)).catch(() => undefined);
  }

  return (
    <>
      <p data-testid="login-link-times">
        {t("components:login.link_sent_times", {
          sentAt,
          expiresAt,
          formatParams: { sentAt: { timeStyle: "short" }, expiresAt: { timeStyle: "short" } },
        })}
      </p>
      <details data-testid="login-link-help">
        <summary style={{ cursor: 'pointer', width: 'fit-content' }}>{t("components:login.help_title")}</summary>
        <p>
          {sender
            ? <Trans
              i18nKey="components:login.help_wait"
              values={{ sender }}
              components={{ sender: <a href={`mailto:${sender}?subject=test`} style={{ overflowWrap: 'anywhere' }} /> }}
            />
            : t("components:login.help_wait_no_sender")
          }
        </p>
        <p>{t("components:login.help_it_support")}</p>
        <blockquote
          className="smooth padding-75 margin-inline-0 font-size-14px"
          style={{ border: '1px solid var(--gray-80)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          data-testid="login-link-it-text"
        >
          {itText}
        </blockquote>
        <button type="button" className="font-size-14px" onClick={copy} aria-live="polite">
          {copied ? t("components:login.help_copied") : t("components:login.help_copy")}
        </button>
      </details>
    </>
  );
}
