"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { safeRedirectPath } from "@/functions/safeRedirectPath";
import { useToast } from "@/components/generic/toast/toastContext.use";

type State = { kind: "loading" } | { kind: "ready", token: string } | { kind: "missing" } | { kind: "submitting", token: string } | { kind: "failed" };

/**
 * Reads the login token from the URL fragment (`#t=…`), scrubs it from the address
 * bar, and redeems it through PATCH /api/login-link when the user clicks.
 */
export default function LoginLinkButton() {
  const { t } = useTranslation("pages");
  const router = useRouter();
  const { addToast } = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("t");
    if (token) {
      // Keep the token out of the history and out of anything that reads location later
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setState({ kind: "ready", token });
    }
    else {
      // Only a first look without a token means "missing": React may run this effect again
      // (dev strict mode) after the hash has already been scrubbed above
      setState(previous => previous.kind === "loading" ? { kind: "missing" } : previous);
    }
  }, []);

  function redeem(token: string) {
    setState({ kind: "submitting", token });
    fetch("/api/login-link", {
      method: "PATCH",
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json() as { redirect?: string, name?: string | null };
      // The toast list lives in the root layout, so it outlives the navigation
      addToast(data.name ? t("pages:login_link.welcome_back_toast", { name: data.name }) : t("pages:login_link.welcome_toast"), "success");
      router.push(safeRedirectPath(data.redirect));
      router.refresh();
    }).catch(() => {
      setState({ kind: "failed" });
    });
  }

  if (state.kind === "loading") {
    return null;
  }

  if (state.kind === "missing" || state.kind === "failed") {
    return (
      <>
        <p role="alert" data-testid="login-link-error">{state.kind === "missing" ? t("pages:login_link.missing") : t("pages:login_link.invalid")}</p>
        <Link href="/login">{t("pages:login_link.back_to_login")}</Link>
      </>
    );
  }

  return (
    <>
      <p>{t("pages:login_link.description")}</p>
      <button
        type="button"
        className="seagreen color-purewhite font-weight-bold width-100"
        style={{ fontSize: '1rem' }}
        disabled={state.kind === "submitting"}
        onClick={() => redeem(state.token)}
      >
        {t("pages:login_link.submit")}
      </button>
    </>
  );
}
