'use client';

import React, { useState } from "react";
import { IconBuildingCommunity, IconLock, IconWorld } from "@tabler/icons-react";
import type { AccessControlInfo, AccessControlInput } from "@/types";
import { AccessLevel, Sharing } from "@/lib/prisma/generated";
import styles from '../forms.module.css';
import { useTranslation } from "react-i18next";

/** A grant row's selectable level; NONE means no grant for the group */
const GrantChoice = {
  None: "NONE",
  ReadOnly: AccessLevel.RO,
  ReadWrite: AccessLevel.RW,
} as const;
type GrantChoice = (typeof GrantChoice)[keyof typeof GrantChoice];

/** New roadmaps start shared with the whole org */
const defaultSharing: Sharing = Sharing.ORG;

/**
 * Sharing settings editor for an org-owned access control: who may read
 * (granted groups only / org members / everyone) plus per-group RO/RW grants.
 *
 * Sharing is manager-only on existing content; the parent decides whether to
 * render this at all. `mayEditPublic` gates the PUBLIC option (it is
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
  initialAccess?: Pick<AccessControlInfo, "sharing" | "grants">,
  /** Whether the user may make the item public (org manager / super admin) */
  mayEditPublic: boolean,
  /** Called with the full sharing input whenever anything changes */
  onChange: (access: AccessControlInput) => void,
  positionIndex: number,
  legend: string,
}) {
  const { t } = useTranslation(["forms"]);

  const [sharing, setSharing] = useState<Sharing>(initialAccess?.sharing ?? defaultSharing);
  const [grants, setGrants] = useState<Record<string, GrantChoice>>(() => {
    const initial: Record<string, GrantChoice> = {};
    for (const group of groups) {
      initial[group.id] = initialAccess?.grants.find(grant => grant.group_id === group.id)?.access_level ?? GrantChoice.None;
    }
    return initial;
  });

  const emit = (nextSharing: Sharing, nextGrants: Record<string, GrantChoice>) => {
    onChange({
      sharing: nextSharing,
      grants: Object.entries(nextGrants)
        .filter(([, level]) => level !== GrantChoice.None)
        .map(([groupId, level]) => ({ groupId, accessLevel: level as AccessLevel })),
    });
  };

  const changeSharing = (next: Sharing) => {
    setSharing(next);
    emit(next, grants);
  };

  const changeGrant = (groupId: string, level: GrantChoice) => {
    const next = { ...grants, [groupId]: level };
    setGrants(next);
    emit(sharing, next);
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
            value: Sharing.GROUPS,
            icon: <IconLock aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.granted_groups_only"),
            description: t("forms:access_selector.granted_groups_only_description"),
            available: true,
          },
          {
            value: Sharing.ORG,
            icon: <IconBuildingCommunity aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.org_members"),
            description: t("forms:access_selector.org_members_description"),
            available: true,
          },
          {
            value: Sharing.PUBLIC,
            icon: <IconWorld aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />,
            label: t("forms:access_selector.all_users"),
            description: t("forms:access_selector.all_users_description"),
            // PUBLIC is only honored for org managers / super admins
            available: mayEditPublic,
          },
        ] satisfies { value: Sharing, icon: React.ReactNode, label: string, description: string, available: boolean }[])
          .filter(option => option.available)
          .map(option => (
            <label key={option.value} className="flex align-items-start gap-50 margin-top-50 margin-bottom-50">
              <input
                required={true}
                type="radio"
                name="sharing"
                value={option.value}
                checked={sharing === option.value}
                onChange={() => changeSharing(option.value)}
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
