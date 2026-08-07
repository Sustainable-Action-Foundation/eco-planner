'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import formSubmitter from "@/functions/formSubmitter";
import { useToast } from "@/components/generic/toast/toastContext.use";
import type { TFunction } from "i18next";

/** The API's error message if there is one (formSubmitter throws 4xx bodies as plain objects, not Errors) */
function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') return err.message;
  return t("common:errors.something_went_wrong");
}

/** Accept button for a guest invite; the API checks that the signed-in user's email matches the invite */
export default function AcceptInvite({ token, orgName }: { token: string, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function accept() {
    formSubmitter('/api/guest-invite', JSON.stringify({ token }), 'PUT', t, setIsLoading, undefined, () => {
      addToast(t("pages:invite.accepted_toast", { org: orgName }), "success");
      router.push('/');
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <button
      type="button"
      className="seagreen color-purewhite round font-weight-500 margin-top-100"
      disabled={isLoading}
      data-testid="accept-invite"
      onClick={accept}
    >
      {t("pages:invite.accept", { org: orgName })}
    </button>
  );
}
