'use client';

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { closeModal, openModal } from "@/components/modals/modalFunctions";
import styles from "@/components/modals/modals.module.css";
import { useToast } from "@/components/generic/toast/toastContext.use";

/**
 * "Log out everywhere": bumps the user's session version so every device holding a
 * cookie for them reads as anonymous (POST /api/logout { everywhere: true }). On your
 * own page it logs this browser out too; a super admin can revoke another user's
 * sessions from that user's page and stays logged in.
 */
export default function LogoutEverywhereButton({ username, userId }: {
  username: string,
  /** The user to revoke; omitted on your own page */
  userId?: string,
}) {
  const { t } = useTranslation(["components", "common"]);
  const router = useRouter();
  const { addToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const self = userId === undefined;

  function logoutEverywhere() {
    setIsLoading(true);
    fetch("/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ everywhere: true, ...(self ? {} : { userId }) }),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      closeModal(dialogRef);
      if (self) {
        router.push("/");
        router.refresh();
      }
      else {
        addToast(t("components:logout_everywhere.done", { name: username }), "success");
      }
    }).catch((err: unknown) => {
      console.error("Logout everywhere failed:", err);
      addToast(t("components:logout_everywhere.failed"), "error");
    }).finally(() => setIsLoading(false));
  }

  return (
    <>
      <button type="button" className="red color-purewhite" data-testid="logout-everywhere-button" onClick={() => openModal(dialogRef)}>
        {self ? t("components:logout_everywhere.button_self") : t("components:logout_everywhere.button_other", { name: username })}
      </button>

      <dialog
        closedby="any"
        ref={dialogRef}
        aria-modal={true}
        className={`rounded padding-inline-0 padding-block-0 ${styles['dialog']}`}
        style={{ width: 'min(60ch, 100%)', fontSize: 'initial' }}
      >
        <div className={`${styles['dialog-content']}`}>
          <div className={`${styles['dialog-header']}`}>
            <button type="button" className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(dialogRef)} autoFocus={true} aria-label={t("common:tsx.close")}>
              <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
            </button>
            <h2 className="margin-0">{t("components:logout_everywhere.title")}</h2>
          </div>
          <div className="padding-100 flex flex-direction-column gap-100">
            <p className="margin-0">
              {self ? t("components:logout_everywhere.confirm_self") : t("components:logout_everywhere.confirm_other", { name: username })}
            </p>
            <div className="flex gap-25">
              <button type="button" className="font-weight-500 flex-grow-100" disabled={isLoading} onClick={() => closeModal(dialogRef)}>{t("common:tsx.cancel")}</button>
              <button type="button" className="color-purewhite red font-weight-500" data-testid="logout-everywhere-confirm" disabled={isLoading} onClick={logoutEverywhere}>
                {self ? t("components:logout_everywhere.button_self") : t("components:logout_everywhere.button_other", { name: username })}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
