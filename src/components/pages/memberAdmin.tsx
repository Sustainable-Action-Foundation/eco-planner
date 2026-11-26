'use client';

import styles from "./memberAdmin.module.css" with { type: "css" };
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { IFuseOptions } from "fuse.js";
import formSubmitter from "@/functions/formSubmitter";
import { leavesOrgWithoutManager } from "@/functions/orgMembership";
import { useToast } from "@/components/generic/toast/toastContext.use";
import SelectSingleSearch from "@/components/form/elements/combobox/selectSingleSearch";
import HydratedForm from "@/components/form/hydratedForm";
import type { Option } from "@/components/types";
import type { OrgMemberAdmin } from "@/fetchers/getOrgMemberAdmin";
import { useIsClient } from "@/functions/useClientState";
import { OrgRole } from "@/lib/prisma/generated";

type Everyone = NonNullable<OrgMemberAdmin["everyone"]>;
type AssignableRole = typeof OrgRole.MEMBER | typeof OrgRole.MANAGER;

/** Names, addresses and org names share one label, so a match may sit anywhere in it; stricter than the default fuzziness, or an address matches half the list */
const searchAnywhere: IFuseOptions<Option> = { ignoreLocation: true, threshold: 0.3 };

/** Leaves room for the role and the button on the same line */
const selectStyle: React.CSSProperties = { width: "min(100%, 24rem)" };

/** The API's error message if there is one (formSubmitter throws 4xx bodies as plain objects, not Errors) */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') return err.message;
  return fallback;
}

/** MEMBER unless the value is MANAGER: the two roles that can be given here */
function pickedRole(value: string): AssignableRole {
  return value === OrgRole.MANAGER ? OrgRole.MANAGER : OrgRole.MEMBER;
}

/**
 * Who the org's members are, on the org manage page. Two boxes, one per role, so
 * that each colour means one thing:
 * - the manager yellow: what the org's managers may do (super admins too): add someone
 *   by their exact e-mail address, remove a member, move one to another org they manage;
 * - the super-admin orange, only with `admin.everyone`: what the powers add: picking
 *   from every user, and moving a member to any org.
 * The server page only passes what the requester may have (see `getOrgMemberAdmin`),
 * and the API checks again on every request.
 */
export default function MemberAdmin({ admin, orgName }: { admin: OrgMemberAdmin, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);

  return (
    <>
      <div className={`${styles.panel} ${styles.manager}`} role="group" aria-labelledby="member-manage-heading" data-testid="member-manage">
        <div className="flex gap-50 flex-wrap-wrap align-items-center">
          <h3 id="member-manage-heading" className="margin-0 font-size-100">{t("pages:org_groups.member_admin.manage_heading")}</h3>
          <span className={styles.badge}>{t("pages:org_groups.roles.manager")}</span>
        </div>
        <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>{t("pages:org_groups.member_admin.manage_description")}</p>
        <AddByEmail admin={admin} orgName={orgName} />
        <ChangeMember
          idPrefix="member-manage"
          admin={admin}
          orgName={orgName}
          // One's own membership is locked for managers, like one's own role
          members={admin.members.filter(member => member.membershipId !== admin.lockedMembershipId)}
          targets={admin.managedOrgs}
          canRemove={true}
        />
        {admin.lockedMembershipId ? (
          <p className="margin-block-50 font-size-14px">{t("pages:org_groups.member_admin.own_membership_hint")}</p>
        ) : null}
      </div>

      {admin.everyone ? (
        <div className={`${styles.panel} ${styles['super-admin']}`} role="group" aria-labelledby="member-admin-heading" data-testid="member-admin">
          <div className="flex gap-50 flex-wrap-wrap align-items-center">
            <h3 id="member-admin-heading" className="margin-0 font-size-100">{t("pages:org_groups.member_admin.heading")}</h3>
            <span className={styles.badge}>{t("pages:org_groups.member_admin.badge")}</span>
          </div>
          <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>{t("pages:org_groups.member_admin.description")}</p>
          <AddFromList admin={admin} everyone={admin.everyone} orgName={orgName} />
          <ChangeMember
            idPrefix="member-admin"
            admin={admin}
            orgName={orgName}
            members={admin.members}
            targets={admin.everyone.orgs}
            canRemove={false}
          />
        </div>
      ) : null}
    </>
  );
}

/** The two roles a membership can be given here */
function RoleSelect({ value, onChange, disabled, testId }: { value: string, onChange: (role: AssignableRole) => void, disabled: boolean, testId: string }) {
  const { t } = useTranslation(["pages"]);
  return (
    <select
      aria-label={t("pages:org_groups.member_admin.role_label")}
      style={{ padding: '.5rem' }}
      value={value}
      disabled={disabled}
      data-testid={testId}
      onChange={(event) => onChange(pickedRole(event.target.value))}
    >
      <option value={OrgRole.MEMBER}>{t("pages:org_groups.roles.member")}</option>
      <option value={OrgRole.MANAGER}>{t("pages:org_groups.roles.manager")}</option>
    </select>
  );
}

/**
 * Add someone who already has an account by typing their exact e-mail address. A
 * manager never sees who has an account: the server answers for that one address.
 */
function AddByEmail({ admin, orgName }: { admin: OrgMemberAdmin, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>(OrgRole.MEMBER);
  const [isLoading, setIsLoading] = useState(false);
  // Typing before hydration would not reach the state the add button reads
  const isClient = useIsClient();

  function add(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    formSubmitter('/api/org-membership', JSON.stringify({
      orgId: admin.orgId,
      email: address,
      role,
    }), 'POST', t, setIsLoading, undefined, () => {
      setIsLoading(false);
      addToast(t("pages:org_groups.member_admin.added_toast", { name: address, org: orgName }), "success");
      setEmail("");
      setRole(OrgRole.MEMBER);
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t("common:errors.something_went_wrong")), "error");
    }, addToast);
  }

  return (
    <HydratedForm onSubmit={add} className="margin-top-100" data-testid="member-manage-add">
      <label className="font-weight-500" htmlFor="member-manage-email">{t("pages:org_groups.member_admin.email_label")}</label>
      <div className="flex gap-50 flex-wrap-wrap align-items-center margin-top-25">
        <input
          id="member-manage-email"
          type="email"
          required={true}
          autoComplete="off"
          style={selectStyle}
          placeholder={t("pages:org_groups.member_admin.email_placeholder")}
          readOnly={!isClient}
          value={email}
          data-testid="member-manage-email"
          onChange={(event) => setEmail(event.target.value)}
        />
        <RoleSelect value={role} onChange={setRole} disabled={isLoading} testId="member-manage-add-role" />
        <button type="submit" className="seagreen color-purewhite" disabled={isLoading || !email.trim()} data-testid="member-manage-add-submit">
          {t("pages:org_groups.member_admin.add")}
        </button>
      </div>
      <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>{t("pages:org_groups.member_admin.email_hint")}</p>
    </HydratedForm>
  );
}

/** Super admins: search every user outside the org by name, address or org and add one */
function AddFromList({ admin, everyone, orgName }: { admin: OrgMemberAdmin, everyone: Everyone, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AssignableRole>(OrgRole.MEMBER);
  const [isLoading, setIsLoading] = useState(false);
  // Remount the user select after a successful add to clear it
  const [addedCount, setAddedCount] = useState(0);

  const options = useMemo<Option[]>(() => everyone.candidates.map(user => ({
    // Where the user belongs today tells a demo account from a namesake at a glance
    name: [user.name, user.email, user.otherOrgs.length > 0 ? user.otherOrgs.join(", ") : t("pages:org_groups.member_admin.no_org")].join(" · "),
    value: user.userId,
  })), [everyone.candidates, t]);

  function add(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = everyone.candidates.find(candidate => candidate.userId === userId);
    if (!user) return;
    formSubmitter('/api/org-membership', JSON.stringify({
      orgId: admin.orgId,
      userId: user.userId,
      role,
    }), 'POST', t, setIsLoading, undefined, () => {
      setIsLoading(false);
      addToast(t("pages:org_groups.member_admin.added_toast", { name: user.name, org: orgName }), "success");
      setUserId("");
      setRole(OrgRole.MEMBER);
      setAddedCount(count => count + 1);
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t("common:errors.something_went_wrong")), "error");
    }, addToast);
  }

  return (
    <HydratedForm onSubmit={add} className="margin-top-100" data-testid="member-admin-add">
      <label className="font-weight-500" htmlFor="member-admin-user">{t("pages:org_groups.member_admin.add_label")}</label>
      <div className="flex gap-50 flex-wrap-wrap align-items-center margin-top-25">
        <SelectSingleSearch
          key={addedCount}
          props={{
            id: "member-admin-user",
            name: "user",
            placeholder: t("pages:org_groups.member_admin.user_placeholder"),
            style: selectStyle,
          }}
          defaultValue={false}
          options={options}
          fuseOptions={searchAnywhere}
          onChange={(option) => setUserId(option?.value ?? "")}
        />
        <RoleSelect value={role} onChange={setRole} disabled={isLoading} testId="member-admin-add-role" />
        <button type="submit" className="seagreen color-purewhite" disabled={isLoading || !userId} data-testid="member-admin-add-submit">
          {t("pages:org_groups.member_admin.add")}
        </button>
      </div>
    </HydratedForm>
  );
}

/**
 * Pick one of the org's members, then move them to one of `targets` and, with
 * `canRemove`, remove them. Without targets there is no move; with neither, nothing
 * is rendered. Ids and test ids start with `idPrefix`, one per box.
 */
function ChangeMember({ idPrefix, admin, orgName, members, targets, canRemove }: {
  idPrefix: "member-manage" | "member-admin",
  admin: OrgMemberAdmin,
  orgName: string,
  /** The members offered: everyone the requester may act on */
  members: OrgMemberAdmin["members"],
  /** Where a picked member can be moved */
  targets: { id: string, name: string }[],
  canRemove: boolean,
}) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [membershipId, setMembershipId] = useState("");
  const [targetOrgId, setTargetOrgId] = useState("");
  const [role, setRole] = useState<AssignableRole>(OrgRole.MEMBER);
  // Removing takes two clicks: the first arms the button, the second removes
  const [removeArmed, setRemoveArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Remount the selects after a change to clear them
  const [changedCount, setChangedCount] = useState(0);

  const canMove = targets.length > 0;
  const member = members.find(candidate => candidate.membershipId === membershipId);
  const target = targets.find(org => org.id === targetOrgId);

  const memberOptions = useMemo<Option[]>(() => members.map(user => ({
    name: [
      user.name,
      // Only super admins are given addresses
      ...(user.email ? [user.email] : []),
      ...(user.role === OrgRole.MANAGER ? [t("pages:org_groups.roles.manager")] : user.role === OrgRole.GUEST ? [t("pages:org_groups.roles.guest")] : []),
    ].join(" · "),
    value: user.membershipId,
  })), [members, t]);
  const orgOptions = useMemo<Option[]>(() => targets.map(org => ({ name: org.name, value: org.id })), [targets]);

  if (!canMove && !canRemove) {
    return null;
  }

  function pick(option: Option | null) {
    const picked = members.find(candidate => candidate.membershipId === option?.value);
    setMembershipId(picked?.membershipId ?? "");
    // A move keeps the role unless another is chosen
    setRole(pickedRole(picked?.role ?? OrgRole.MEMBER));
    setTargetOrgId("");
    setRemoveArmed(false);
  }

  function changed() {
    setIsLoading(false);
    setMembershipId("");
    setTargetOrgId("");
    setRemoveArmed(false);
    setChangedCount(count => count + 1);
    router.refresh();
  }

  function failed(err: unknown) {
    setIsLoading(false);
    setRemoveArmed(false);
    addToast(errorMessage(err, t("common:errors.something_went_wrong")), "error");
  }

  function move(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || !target) return;
    formSubmitter('/api/org-membership', JSON.stringify({
      membershipId: member.membershipId,
      orgId: target.id,
      role,
    }), 'PATCH', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.member_admin.moved_toast", { name: member.name, org: target.name }), "success");
      changed();
    }, failed, addToast);
  }

  function remove() {
    if (!member) return;
    if (!removeArmed) {
      setRemoveArmed(true);
      return;
    }
    formSubmitter('/api/org-membership', JSON.stringify({ membershipId: member.membershipId }), 'DELETE', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.member_admin.removed_toast", { name: member.name, org: orgName }), "success");
      changed();
    }, failed, addToast);
  }

  return (
    <HydratedForm onSubmit={move} className="margin-top-100" data-testid={`${idPrefix}-change`}>
      <label className="font-weight-500" htmlFor={`${idPrefix}-member`}>
        {canRemove && canMove ? t("pages:org_groups.member_admin.change_label")
          : canRemove ? t("pages:org_groups.member_admin.remove_label")
            : t("pages:org_groups.member_admin.move_any_label")}
      </label>
      <SelectSingleSearch
        key={changedCount}
        props={{
          id: `${idPrefix}-member`,
          name: "member",
          placeholder: t("pages:org_groups.member_admin.member_placeholder"),
          className: "margin-top-25",
          style: selectStyle,
        }}
        defaultValue={false}
        options={memberOptions}
        fuseOptions={searchAnywhere}
        onChange={pick}
      />

      {member ? (
        <div className={styles.actions} data-testid={`${idPrefix}-actions`}>
          {leavesOrgWithoutManager(admin.members, member.membershipId) ? (
            <p className={`${styles.warning} margin-top-0 margin-bottom-50 font-size-14px`} data-testid={`${idPrefix}-last-manager`}>
              {t("pages:org_groups.member_admin.last_manager_warning", { name: member.name, org: orgName })}
            </p>
          ) : null}

          {canMove ? (
            <>
              <label className="font-weight-500" htmlFor={`${idPrefix}-target`}>{t("pages:org_groups.member_admin.move_label", { name: member.name })}</label>
              <div className="flex gap-50 flex-wrap-wrap align-items-center margin-top-25">
                <SelectSingleSearch
                  // A newly picked member starts without a target
                  key={member.membershipId}
                  props={{
                    id: `${idPrefix}-target`,
                    name: "target",
                    placeholder: t("pages:org_groups.member_admin.target_placeholder"),
                    style: selectStyle,
                  }}
                  defaultValue={false}
                  options={orgOptions}
                  fuseOptions={searchAnywhere}
                  onChange={(option) => setTargetOrgId(option?.value ?? "")}
                />
                <RoleSelect value={role} onChange={setRole} disabled={isLoading} testId={`${idPrefix}-move-role`} />
                <button type="submit" className="seagreen color-purewhite" disabled={isLoading || !target} data-testid={`${idPrefix}-move-submit`}>
                  {t("pages:org_groups.member_admin.move")}
                </button>
              </div>
              <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>
                {canRemove ? t("pages:org_groups.member_admin.move_managed_hint") : t("pages:org_groups.member_admin.move_hint")}
              </p>
            </>
          ) : null}

          {canRemove ? (
            <button
              type="button"
              className={removeArmed ? "red color-purewhite" : ""}
              disabled={isLoading}
              data-testid={`${idPrefix}-remove`}
              onClick={remove}
            >
              {removeArmed
                ? t("pages:org_groups.confirm_delete")
                : t("pages:org_groups.member_admin.remove", { org: orgName })}
            </button>
          ) : null}
        </div>
      ) : null}
    </HydratedForm>
  );
}
