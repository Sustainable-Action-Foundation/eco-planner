'use client';

import React, { useState } from "react";
import { IconBuildingCommunity, IconLock, IconWorld, IconX } from "@tabler/icons-react";
import type { AccessControlInfo, AccessControlInput } from "@/types";
import { AccessLevel, Sharing } from "@/lib/prisma/generated";
import styles from '../forms.module.css';
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "@/components/form/elements/combobox/selectSingleSearch";

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
  id,
  children,
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
  /** Anchor for links straight to the sharing settings (e.g. `#sharing`) */
  id?: string,
  /** Further visibility settings of the item, shown after the grants */
  children?: React.ReactNode,
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

  // Only granted groups are listed; the rest wait in the "add group" picker
  const granted = groups.filter(group => (grants[group.id] ?? GrantChoice.None) !== GrantChoice.None);
  const available = groups.filter(group => (grants[group.id] ?? GrantChoice.None) === GrantChoice.None);

  const changeSharing = (next: Sharing) => {
    setSharing(next);
    emit(next, grants);
  };

  const changeGrant = (groupId: string, level: GrantChoice) => {
    const next = { ...grants, [groupId]: level };
    setGrants(next);
    emit(sharing, next);
  };

  // Under org or public sharing everyone already reads, so a new grant is there to let the group edit
  const addGrant = (groupId: string) => changeGrant(groupId, sharing === Sharing.GROUPS ? GrantChoice.ReadOnly : GrantChoice.ReadWrite);

  return (
    <fieldset id={id} className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
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
        {/* Managers otherwise build all-staff groups by hand to get exactly this */}
        {sharing !== Sharing.PUBLIC ? (
          <p className="margin-block-25 font-size-14px color-gray">{t("forms:access_selector.org_sharing_hint")}</p>
        ) : null}
        {groups.length === 0 ? (
          <p className="margin-block-25 font-style-italic">{t("forms:access_selector.no_groups")}</p>
        ) : (
          <>
            {granted.length === 0 ? (
              <p className="margin-block-25 font-style-italic" data-testid="grant-empty">
                {sharing === Sharing.GROUPS ? t("forms:access_selector.no_grants_groups_sharing") : t("forms:access_selector.no_grants")}
              </p>
            ) : (
              <ul className="margin-block-50 padding-0 flex flex-direction-column gap-25" style={{ listStyle: 'none', maxWidth: '36rem' }} data-testid="grant-list">
                {granted.map(group => (
                  <li
                    key={group.id}
                    className="flex align-items-center gap-50 padding-block-25 padding-inline-50 smooth"
                    style={{ border: '1px solid var(--gray-80)' }}
                    data-testid="grant-row"
                    data-group-id={group.id}
                  >
                    <span className="flex-grow-100" style={{ overflowWrap: 'anywhere' }}>{group.name}</span>
                    <select
                      className="width-fit-content"
                      aria-label={t("forms:access_selector.level_for", { group: group.name })}
                      value={grants[group.id]}
                      onChange={(e) => changeGrant(group.id, e.target.value as GrantChoice)}
                    >
                      <option value={GrantChoice.ReadOnly}>{t("forms:access_selector.read_only")}</option>
                      <option value={GrantChoice.ReadWrite}>{t("forms:access_selector.read_write")}</option>
                    </select>
                    <button
                      type="button"
                      className="transparent padding-25 smooth display-flex"
                      aria-label={t("forms:access_selector.remove_grant", { group: group.name })}
                      title={t("forms:access_selector.remove_grant", { group: group.name })}
                      onClick={() => changeGrant(group.id, GrantChoice.None)}
                      data-testid="grant-remove"
                    >
                      <IconX aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {available.length > 0 ? (
              // Remounted after every pick so the picker is empty again for the next group
              <SelectSingleSearch
                key={granted.length}
                props={{
                  id: "grant-add",
                  name: "grant-add",
                  className: "margin-top-50",
                  style: { maxWidth: '36rem' },
                  placeholder: t("forms:access_selector.add_group"),
                }}
                defaultValue={false}
                options={available.map(group => ({ name: group.name, value: group.id }))}
                onChange={(option) => { if (option) addGrant(option.value); }}
              />
            ) : (
              <p className="margin-block-25 font-size-14px color-gray">{t("forms:access_selector.all_groups_granted")}</p>
            )}
          </>
        )}
      </fieldset>
      {children}
    </fieldset>
  );
}
