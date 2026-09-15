"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useTranslation } from "react-i18next";

/**
 * The start page's org switcher for users with many orgs (mostly super admins):
 * a select in place of one chip per org. Navigates the same way the chips do
 * and wears the active chip's look, since it always shows the current view.
 */
export default function OrgSelect({ orgs, selectedOrgId }: { orgs: { id: string, name: string }[], selectedOrgId: string | null }) {
  const router = useRouter();
  const { t } = useTranslation(["pages", "common"]);

  return (
    <select
      // Remount on navigation so the server-decided selection wins over a stale default
      key={selectedOrgId ?? 'public'}
      className="button round smooth seagreen color-purewhite font-weight-500"
      style={{ border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}
      aria-label={t("pages:home.org_nav_label")}
      defaultValue={selectedOrgId ?? 'public'}
      onChange={(e) => { const value = e.target.value; startTransition(() => { router.push(`/?org=${value}`); }); }}
    >
      {orgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
      <option value="public">{t("pages:home.public_tab")}</option>
    </select>
  );
}
