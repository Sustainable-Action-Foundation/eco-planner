"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "@/components/form/elements/combobox/selectSingleSearch";
import { useIsClient } from "@/functions/useClientState";
import type { Option } from "@/components/types";
import styles from "./orgSelect.module.css" with { type: "css" };

const publicValue = "public";

/**
 * The start page's org switcher for users with many orgs (mostly super admins):
 * a searchable select in place of one chip per org. Navigates the same way the chips do
 * and wears the active chip's look, since it always shows the current view.
 */
export default function OrgSelect({ orgs, selectedOrgId }: { orgs: { id: string, name: string }[], selectedOrgId: string | null }) {
  const router = useRouter();
  const { t } = useTranslation(["pages", "common"]);
  const isClient = useIsClient();

  const publicName = t("pages:home.public_tab");
  const options = useMemo<Option[]>(
    () => [...orgs.map(org => ({ name: org.name, value: org.id })), { name: publicName, value: publicValue }],
    [orgs, publicName],
  );
  const selected = options.find(option => option.value === (selectedOrgId ?? publicValue)) ?? options[options.length - 1];

  return (
    <SelectSingleSearch
      // Remount on navigation so the server-decided selection wins over a stale choice
      key={selected.value}
      props={{
        id: "org-switcher",
        name: "org",
        className: styles.switcher,
        ariaLabel: t("pages:home.org_nav_label"),
        // Shown while nothing is selected: before the default lands, and if the current view is picked again (which deselects)
        placeholder: selected.name,
        // A click before hydration would open nothing
        disabled: !isClient,
      }}
      defaultValue={selected}
      options={options}
      onChange={(option) => {
        if (!option || option.value === selected.value) return;
        startTransition(() => { router.push(`/?org=${option.value}`); });
      }}
    />
  );
}
