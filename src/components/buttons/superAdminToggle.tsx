'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/generic/toast/toastContext.use";

/**
 * Switches the signed-in super admin's powers on or off for this browser session
 * (POST /api/user/privileges). Off, they see the tool as a regular member of their
 * orgs; this switch is the one thing that stays. Reversible, so no confirmation.
 */
export default function SuperAdminToggle({ active }: {
  /** Whether the super-admin powers are currently on */
  active: boolean,
}) {
  const { t } = useTranslation(["components"]);
  const router = useRouter();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  function toggle(superAdmin: boolean) {
    setIsLoading(true);
    fetch("/api/user/privileges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ superAdmin }),
    }).then((res) => {
      if (!res.ok) {
        throw new Error(`${res.status}`);
      }
      router.refresh();
    }).catch((err: unknown) => {
      console.error("Super admin toggle failed:", err);
      addToast(t("components:super_admin_toggle.failed"), "error");
    }).finally(() => setIsLoading(false));
  }

  return (
    <label className="flex align-items-center gap-50">
      <input
        type="checkbox"
        role="switch"
        checked={active}
        disabled={isLoading}
        onChange={event => toggle(event.target.checked)}
        data-testid="super-admin-toggle"
      />
      {active ? t("components:super_admin_toggle.on") : t("components:super_admin_toggle.off")}
    </label>
  );
}
