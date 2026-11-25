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
import { OrgRole } from "@/lib/prisma/generated";

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
function pickedRole(value: string): typeof OrgRole.MEMBER | typeof OrgRole.MANAGER {
  return value === OrgRole.MANAGER ? OrgRole.MANAGER : OrgRole.MEMBER;
}

/**
 * Super-admin-only membership administration on the org manage page: add an existing
 * user to the org, remove a member, or move a member to another org. The server page
 * only passes `admin` to those who may (see `getOrgMemberAdmin`), and the API checks
 * again on every request.
 */
export default function MemberAdmin({ admin, orgName }: { admin: OrgMemberAdmin, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);

  return (
    <div className={styles.panel} role="group" aria-labelledby="member-admin-heading" data-testid="member-admin">
      <div className="flex gap-50 flex-wrap-wrap align-items-center">
        <h3 id="member-admin-heading" className="margin-0 font-size-100">{t("pages:org_groups.member_admin.heading")}</h3>
        <span className={styles.badge}>{t("pages:org_groups.member_admin.badge")}</span>
      </div>
      <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>{t("pages:org_groups.member_admin.description")}</p>
      <AddMember admin={admin} orgName={orgName} />
      <ChangeMember admin={admin} orgName={orgName} />
    </div>
  );
}

/** The two roles a membership can be given here */
function RoleSelect({ value, onChange, disabled, testId }: { value: string, onChange: (role: typeof OrgRole.MEMBER | typeof OrgRole.MANAGER) => void, disabled: boolean, testId: string }) {
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

/** Search every user outside the org by name or address and add one */
function AddMember({ admin, orgName }: { admin: OrgMemberAdmin, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<typeof OrgRole.MEMBER | typeof OrgRole.MANAGER>(OrgRole.MEMBER);
  const [isLoading, setIsLoading] = useState(false);
  // Remount the user select after a successful add to clear it
  const [addedCount, setAddedCount] = useState(0);

  const options = useMemo<Option[]>(() => admin.candidates.map(user => ({
    // Where the user belongs today tells a demo account from a namesake at a glance
    name: [user.name, user.email, user.otherOrgs.length > 0 ? user.otherOrgs.join(", ") : t("pages:org_groups.member_admin.no_org")].join(" · "),
    value: user.userId,
  })), [admin.candidates, t]);

  function add(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = admin.candidates.find(candidate => candidate.userId === userId);
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

/** Pick one of the org's members, then remove them or move them to another org */
function ChangeMember({ admin, orgName }: { admin: OrgMemberAdmin, orgName: string }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [membershipId, setMembershipId] = useState("");
  const [targetOrgId, setTargetOrgId] = useState("");
  const [role, setRole] = useState<typeof OrgRole.MEMBER | typeof OrgRole.MANAGER>(OrgRole.MEMBER);
  // Removing takes two clicks: the first arms the button, the second removes
  const [removeArmed, setRemoveArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Remount the selects after a change to clear them
  const [changedCount, setChangedCount] = useState(0);

  const member = admin.members.find(candidate => candidate.membershipId === membershipId);
  const target = admin.orgs.find(org => org.id === targetOrgId);

  const memberOptions = useMemo<Option[]>(() => admin.members.map(user => ({
    name: [
      user.name,
      user.email,
      ...(user.role === OrgRole.MANAGER ? [t("pages:org_groups.roles.manager")] : user.role === OrgRole.GUEST ? [t("pages:org_groups.roles.guest")] : []),
    ].join(" · "),
    value: user.membershipId,
  })), [admin.members, t]);
  const orgOptions = useMemo<Option[]>(() => admin.orgs.map(org => ({ name: org.name, value: org.id })), [admin.orgs]);

  function pick(option: Option | null) {
    const picked = admin.members.find(candidate => candidate.membershipId === option?.value);
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
    <HydratedForm onSubmit={move} className="margin-top-100" data-testid="member-admin-change">
      <label className="font-weight-500" htmlFor="member-admin-member">{t("pages:org_groups.member_admin.change_label")}</label>
      <SelectSingleSearch
        key={changedCount}
        props={{
          id: "member-admin-member",
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
        <div className={styles.actions} data-testid="member-admin-actions">
          {leavesOrgWithoutManager(admin.members, member.membershipId) ? (
            <p className={`${styles.warning} margin-top-0 margin-bottom-50 font-size-14px`} data-testid="member-admin-last-manager">
              {t("pages:org_groups.member_admin.last_manager_warning", { name: member.name, org: orgName })}
            </p>
          ) : null}

          <label className="font-weight-500" htmlFor="member-admin-target">{t("pages:org_groups.member_admin.move_label", { name: member.name })}</label>
          <div className="flex gap-50 flex-wrap-wrap align-items-center margin-top-25">
            <SelectSingleSearch
              // A newly picked member starts without a target
              key={member.membershipId}
              props={{
                id: "member-admin-target",
                name: "target",
                placeholder: t("pages:org_groups.member_admin.target_placeholder"),
                style: selectStyle,
              }}
              defaultValue={false}
              options={orgOptions}
              fuseOptions={searchAnywhere}
              onChange={(option) => setTargetOrgId(option?.value ?? "")}
            />
            <RoleSelect value={role} onChange={setRole} disabled={isLoading} testId="member-admin-move-role" />
            <button type="submit" className="seagreen color-purewhite" disabled={isLoading || !target} data-testid="member-admin-move-submit">
              {t("pages:org_groups.member_admin.move")}
            </button>
          </div>
          <p className="margin-block-50 font-size-14px" style={{ maxWidth: '60ch' }}>{t("pages:org_groups.member_admin.move_hint")}</p>

          <button
            type="button"
            className={removeArmed ? "red color-purewhite" : ""}
            disabled={isLoading}
            data-testid="member-admin-remove"
            onClick={remove}
          >
            {removeArmed
              ? t("pages:org_groups.confirm_delete")
              : t("pages:org_groups.member_admin.remove", { org: orgName })}
          </button>
        </div>
      ) : null}
    </HydratedForm>
  );
}
