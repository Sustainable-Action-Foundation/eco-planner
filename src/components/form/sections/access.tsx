'use client';

import React, { useState } from "react";
import { IconBuildingCommunity, IconLock, IconWorld } from "@tabler/icons-react";
import type { AccessControlInfo, AccessControlInput } from "@/types";
import { AccessLevel } from "@/lib/prisma/generated";
import styles from '../forms.module.css';
import { useTranslation } from "react-i18next";

/** A grant row's selectable level; NONE means no grant for the group */
const GrantChoice = {
  None: "NONE",
  ReadOnly: AccessLevel.RO,
  ReadWrite: AccessLevel.RW,
} as const;
type GrantChoice = (typeof GrantChoice)[keyof typeof GrantChoice];

type Visibility = "public" | "org" | "groups";

function toVisibility(access: Pick<AccessControlInfo, "is_public" | "org_readable"> | undefined): Visibility {
  if (!access) return "org";
  if (access.is_public) return "public";
  if (access.org_readable) return "org";
  return "groups";
}

/**
 * Sharing settings editor for an org-owned access control: overall visibility
 * (public / org members / granted groups only) plus per-group RO/RW grants.
 *
 * Sharing is manager-only on existing content; the parent decides whether to
 * render this at all. `mayEditPublic` gates the public option (is_public is
 * only honored for org managers / super admins even on create).
 */
export default function ConfigureAccess({
  groups,
  initialAccess,
  mayEditPublic,
  onChange,
  positionIndex,
  legend,
}: {
  /** The owning org's groups */
  groups: { id: string, name: string }[],
  /** Existing access control when editing; leave undefined when creating */
  initialAccess?: Pick<AccessControlInfo, "is_public" | "org_readable" | "grants">,
  /** Whether the user may make the item public (org manager / super admin) */
  mayEditPublic: boolean,
  /** Called with the full sharing input whenever anything changes */
  onChange: (access: AccessControlInput) => void,
  positionIndex: number,
  legend: string,
}) {
  const { t } = useTranslation(["forms"]);

  const [visibility, setVisibility] = useState<Visibility>(toVisibility(initialAccess));
  const [grants, setGrants] = useState<Record<string, GrantChoice>>(() => {
    const initial: Record<string, GrantChoice> = {};
    for (const group of groups) {
      initial[group.id] = initialAccess?.grants.find(grant => grant.group_id === group.id)?.access_level ?? GrantChoice.None;
    }
    return initial;
  });

  const emit = (nextVisibility: Visibility, nextGrants: Record<string, GrantChoice>) => {
    onChange({
      isPublic: nextVisibility === "public",
      orgReadable: nextVisibility !== "groups",
      grants: Object.entries(nextGrants)
        .filter(([, level]) => level !== GrantChoice.None)
        .map(([groupId, level]) => ({ groupId, accessLevel: level as AccessLevel })),
    });
  };

  const changeVisibility = (next: Visibility) => {
    setVisibility(next);
    emit(next, grants);
  };

  const changeGrant = (groupId: string, level: GrantChoice) => {
    const next = { ...grants, [groupId]: level };
    setGrants(next);
    emit(visibility, next);
  };

  return (
    <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
      <legend data-position={positionIndex} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>
        {legend}
      </legend>

      {/* One tier at a time, narrowest first; styled like the goal form's visibility picker */}
      <fieldset className="fieldset-unset-pseudo-class margin-bottom-100">
        <legend className="font-weight-500 margin-bottom-50">{t("forms:access_selector.visibility")}</legend>
        {([
          {
            value: "groups",
            icon: <IconLock aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.granted_groups_only"),
            description: t("forms:access_selector.granted_groups_only_description"),
            available: true,
          },
          {
            value: "org",
            icon: <IconBuildingCommunity aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.org_members"),
            description: t("forms:access_selector.org_members_description"),
            available: true,
          },
          {
            value: "public",
            icon: <IconWorld aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.all_users"),
            description: t("forms:access_selector.all_users_description"),
            // is_public is only honored for org managers / super admins
            available: mayEditPublic,
          },
        ] satisfies { value: Visibility, icon: React.ReactNode, label: string, description: string, available: boolean }[])
          .filter(option => option.available)
          .map(option => (
            <label key={option.value} className="flex align-items-start gap-50 margin-top-50 margin-bottom-50">
              <input
                required={true}
                type="radio"
                name="visibility"
                value={option.value}
                checked={visibility === option.value}
                onChange={() => changeVisibility(option.value)}
              />
              <span>
                <span className="flex align-items-center gap-25" style={{ textShadow: '0 0' }}>{option.icon}{option.label}</span>
                <span className="block" style={{ color: '#292929' }}>{option.description}</span>
              </span>
            </label>
          ))}
      </fieldset>

      <fieldset className="fieldset-unset-pseudo-class">
        <legend className="font-weight-500 margin-bottom-50">{t("forms:access_selector.group_grants")}</legend>
        {groups.length === 0 ? (
          <p className="margin-block-25 font-style-italic">{t("forms:access_selector.no_groups")}</p>
        ) : (
          <div
            className="grid margin-block-50 gap-50 align-items-center"
            style={{ gridTemplateColumns: 'auto 1fr', columnGap: '1rem' }}
          >
            {groups.map(group => (
              <label key={group.id} className="display-contents">
                <span>{group.name}</span>
                <select
                  className="width-fit-content"
                  value={grants[group.id] ?? GrantChoice.None}
                  onChange={(e) => changeGrant(group.id, e.target.value as GrantChoice)}
                >
                  <option value={GrantChoice.None}>{t("forms:access_selector.no_access")}</option>
                  <option value={GrantChoice.ReadOnly}>{t("forms:access_selector.read_only")}</option>
                  <option value={GrantChoice.ReadWrite}>{t("forms:access_selector.read_write")}</option>
                </select>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </fieldset>
  );
}
