'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import formSubmitter from "@/functions/formSubmitter";
import { useToast } from "@/components/generic/toast/toastContext.use";
import SelectMultipleSearch from "@/components/form/elements/combobox/selectMultipleSearch";
import type { Option } from "@/components/types";
import type { OrgManagement } from "@/fetchers/getOrgManagement";
import { OrgRole } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

/** The API's error message if there is one (formSubmitter throws 4xx bodies as plain objects, not Errors) */
function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') return err.message;
  return t("common:errors.something_went_wrong");
}

function roleLabel(role: OrgRole, t: TFunction): string {
  switch (role) {
    case OrgRole.MANAGER: return t("pages:org_groups.roles.manager");
    case OrgRole.GUEST: return t("pages:org_groups.roles.guest");
    case OrgRole.MEMBER:
    default: return t("pages:org_groups.roles.member");
  }
}

/** A member as a combobox option, searchable by username */
function memberOption(member: OrgManagement["members"][number], t: TFunction): Option {
  return { name: `${member.username} (${roleLabel(member.role, t)})`, value: member.membershipId };
}

/**
 * Manager-only org administration: member roles plus group create/rename/
 * re-member/delete. The server page has already verified the requester
 * manages the org.
 */
export default function GroupManager({ management }: { management: OrgManagement }) {
  const { t } = useTranslation(["pages", "common"]);

  return (
    <>
      <section className="margin-bottom-300">
        <h2 className="font-size-125">{t("pages:org_groups.members_heading")}</h2>
        <MemberRoles management={management} />
      </section>

      <section>
        <h2 className="font-size-125">{t("pages:org_groups.groups_heading")}</h2>
        {management.groups.length === 0 ? (
          <p className="margin-block-100">{t("pages:org_groups.no_groups")}</p>
        ) : (
          management.groups.map(group => (
            // Keyed on content so a router.refresh() after saving remounts with fresh data
            <GroupEditor
              key={`${group.id}:${group.name}:${group.memberIds.join(',')}`}
              group={group}
              members={management.members}
            />
          ))
        )}

        <CreateGroup orgId={management.org.id} members={management.members} />
      </section>
    </>
  );
}

/** Per-member role select: managers promote members to managers and demote them back */
function MemberRoles({ management }: { management: OrgManagement }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function setRole(member: OrgManagement["members"][number], role: string) {
    formSubmitter('/api/org-membership', JSON.stringify({
      membershipId: member.membershipId,
      role,
    }), 'PUT', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.role_updated_toast", { name: member.username }), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <ul className="margin-0 padding-0" style={{ listStyle: 'none' }}>
      {management.members.map(member => {
        // One's own role is locked (an org shouldn't manage away its last manager
        // by accident), and guest status is a different relationship, not a rank
        const locked = member.membershipId === management.selfMembershipId || member.role === OrgRole.GUEST;
        return (
          <li key={member.membershipId} className="flex gap-100 align-items-center margin-block-50" data-testid="member-row">
            <span className="flex-grow-100">{member.username}</span>
            {member.role === OrgRole.GUEST ? (
              <span className="color-gray">{roleLabel(member.role, t)}</span>
            ) : (
              <select
                value={member.role}
                disabled={locked || isLoading}
                data-testid="member-role"
                onChange={(event) => setRole(member, event.target.value)}
              >
                <option value={OrgRole.MEMBER}>{t("pages:org_groups.roles.member")}</option>
                <option value={OrgRole.MANAGER}>{t("pages:org_groups.roles.manager")}</option>
              </select>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GroupEditor({
  group,
  members,
}: {
  group: OrgManagement["groups"][number],
  members: OrgManagement["members"],
}) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState(group.name);
  const [selected, setSelected] = useState<string[]>(group.memberIds);
  // Deleting takes two clicks: the first arms the button, the second deletes
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function save(event: React.FormEvent) {
    event.preventDefault();
    formSubmitter('/api/group', JSON.stringify({
      groupId: group.id,
      name,
      memberIds: selected,
    }), 'PUT', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.saved_toast", { name }), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  function remove() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    formSubmitter('/api/group', JSON.stringify({ groupId: group.id }), 'DELETE', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.deleted_toast", { name: group.name }), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <form onSubmit={save} className="margin-bottom-200 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="group-editor" data-group-id={group.id}>
      <label className="font-weight-500">
        {t("pages:org_groups.name_label")}
        <input
          className="margin-top-25 block"
          type="text"
          required={true}
          data-testid="group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="font-weight-500 block margin-top-100" htmlFor={`group-members-${group.id}`}>
        {t("pages:org_groups.members_legend")}
      </label>
      <SelectMultipleSearch
        props={{
          id: `group-members-${group.id}`,
          name: "members",
          placeholder: t("pages:org_groups.members_placeholder"),
          className: "margin-top-25",
        }}
        defaultValue={members.filter(member => group.memberIds.includes(member.membershipId)).map(member => memberOption(member, t))}
        options={members.map(member => memberOption(member, t))}
        onChange={(options) => setSelected((options ?? []).map(option => option.value))}
      />

      <div className="flex gap-50 margin-top-100">
        <button type="submit" className="seagreen color-purewhite" disabled={isLoading} data-testid="group-save">
          {t("common:tsx.save")}
        </button>
        <button
          type="button"
          className={deleteArmed ? "red color-purewhite" : ""}
          disabled={isLoading}
          data-testid="group-delete"
          onClick={remove}
        >
          {deleteArmed ? t("pages:org_groups.confirm_delete") : t("common:tsx.delete")}
        </button>
      </div>
    </form>
  );
}

function CreateGroup({
  orgId,
  members,
}: {
  orgId: string,
  members: OrgManagement["members"],
}) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Remount the member select after a successful create to clear it
  const [createdCount, setCreatedCount] = useState(0);

  function create(event: React.FormEvent) {
    event.preventDefault();
    formSubmitter('/api/group', JSON.stringify({
      orgId,
      name,
      memberIds: selected,
    }), 'POST', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.created_toast", { name }), "success");
      setName("");
      setSelected([]);
      setCreatedCount(count => count + 1);
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <form onSubmit={create} className="margin-top-300 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="group-create">
      <h3 className="margin-top-0 font-size-125">{t("pages:org_groups.create_group")}</h3>
      <label className="font-weight-500">
        {t("pages:org_groups.name_label")}
        <input
          className="margin-top-25 block"
          type="text"
          required={true}
          data-testid="create-group-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="font-weight-500 block margin-top-100" htmlFor="create-group-members">
        {t("pages:org_groups.members_legend")}
      </label>
      <SelectMultipleSearch
        key={createdCount}
        props={{
          id: "create-group-members",
          name: "members",
          placeholder: t("pages:org_groups.members_placeholder"),
          className: "margin-top-25",
        }}
        options={members.map(member => memberOption(member, t))}
        onChange={(options) => setSelected((options ?? []).map(option => option.value))}
      />

      <button type="submit" className="seagreen color-purewhite margin-top-100" disabled={isLoading} data-testid="create-group-submit">
        {t("pages:org_groups.create_group")}
      </button>
    </form>
  );
}
