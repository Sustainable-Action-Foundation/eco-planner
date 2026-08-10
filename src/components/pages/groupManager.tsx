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

/** A member as a combobox option, searchable by username. Plain members get no
 * suffix: "(Member)" reads too much like "(Manager)" at a glance, and it's the
 * overwhelmingly common case anyway. */
function memberOption(member: OrgManagement["members"][number], t: TFunction): Option {
  return {
    name: member.role === OrgRole.MEMBER ? member.username : `${member.username} (${roleLabel(member.role, t)})`,
    value: member.membershipId,
  };
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
        <details data-testid="members-details">
          <summary className="padding-block-25" style={{ cursor: 'pointer' }}>
            {t("pages:org_groups.member_count", { count: management.members.length })}
          </summary>
          <MemberRoles management={management} />
        </details>
      </section>

      {/* NOTE: Guests are disabled until further notice; restore this section
          (and the InviteGuests component below) when they return.
      <section className="margin-bottom-300">
        <h2 className="font-size-125">{t("pages:org_groups.invite_heading")}</h2>
        <InviteGuests orgId={management.org.id} invites={management.invites} />
      </section> */}

      <section>
        <h2 className="font-size-125">{t("pages:org_groups.groups_heading")}</h2>
        <GroupList management={management} />
        <CreateGroup orgId={management.org.id} members={management.members} />
      </section>
    </>
  );
}

// NOTE: Guests are disabled until further notice.
// /** Email input to invite a guest, plus the org's pending invites with revoke buttons */
// function InviteGuests({ orgId, invites }: { orgId: string, invites: OrgManagement["invites"] }) {
//   const { t } = useTranslation(["pages", "common"]);
//   const { addToast } = useToast();
//   const router = useRouter();
//   const [email, setEmail] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//
//   function invite(event: React.SyntheticEvent<HTMLFormElement>) {
//     event.preventDefault();
//     formSubmitter('/api/guest-invite', JSON.stringify({ orgId, email }), 'POST', t, setIsLoading, undefined, () => {
//       addToast(t("pages:org_groups.invite_sent_toast", { email }), "success");
//       setEmail("");
//       router.refresh();
//     }, (err) => {
//       setIsLoading(false);
//       addToast(errorMessage(err, t), "error");
//       // The invite may have been kept even though sending failed; show it
//       router.refresh();
//     }, addToast);
//   }
//
//   function revoke(invitation: OrgManagement["invites"][number]) {
//     formSubmitter('/api/guest-invite', JSON.stringify({ token: invitation.token }), 'DELETE', t, setIsLoading, undefined, () => {
//       addToast(t("pages:org_groups.invite_revoked_toast", { email: invitation.email }), "success");
//       router.refresh();
//     }, (err) => {
//       setIsLoading(false);
//       addToast(errorMessage(err, t), "error");
//     }, addToast);
//   }
//
//   return (
//     <>
//       <p className="margin-top-0 color-gray">{t("pages:org_groups.invite_description")}</p>
//       <form onSubmit={invite} className="flex gap-50 flex-wrap-wrap align-items-flex-end" data-testid="invite-form">
//         <label className="font-weight-500">
//           {t("pages:org_groups.invite_email_label")}
//           <input
//             className="margin-top-25 block"
//             type="email"
//             required={true}
//             data-testid="invite-email"
//             value={email}
//             onChange={(event) => setEmail(event.target.value)}
//           />
//         </label>
//         <button type="submit" className="seagreen color-purewhite" disabled={isLoading} data-testid="invite-send">
//           {t("pages:org_groups.invite_send")}
//         </button>
//       </form>
//
//       {invites.length > 0 ? (
//         <ul className="margin-0 padding-0 margin-top-100" style={{ listStyle: 'none', maxWidth: '30rem' }}>
//           {invites.map(invitation => (
//             <li key={invitation.token} className="flex gap-100 align-items-center margin-block-25 font-size-14px" data-testid="invite-row">
//               <span className="flex-grow-100 white-space-nowrap text-overflow-ellipsis overflow-hidden">{invitation.email}</span>
//               {/* ISO date, not locale-dependent: SSR and client must agree for hydration */}
//               <span className="color-gray">{new Date(invitation.createdAt).toISOString().slice(0, 10)}</span>
//               <button type="button" disabled={isLoading} data-testid="invite-revoke" onClick={() => revoke(invitation)}>
//                 {t("pages:org_groups.invite_revoke")}
//               </button>
//             </li>
//           ))}
//         </ul>
//       ) : null}
//     </>
//   );
// }

/** The org's groups as rows (member count + truncated names); one at a time expands into an editor */
function GroupList({ management }: { management: OrgManagement }) {
  const { t } = useTranslation(["pages", "common"]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  if (management.groups.length === 0) {
    return <p className="margin-block-100">{t("pages:org_groups.no_groups")}</p>;
  }

  const usernames = new Map(management.members.map(member => [member.membershipId, member.username]));

  return (
    <ul className="margin-0 padding-0" style={{ listStyle: 'none' }}>
      {management.groups.map(group => (
        <li key={group.id} className="margin-bottom-50" data-group-id={group.id}>
          {group.id === editingGroupId ? (
            // Keyed on content so a router.refresh() after saving remounts with fresh data
            <GroupEditor
              key={`${group.id}:${group.name}:${group.memberIds.join(',')}`}
              group={group}
              members={management.members}
              onClose={() => setEditingGroupId(null)}
            />
          ) : (
            <div className="flex gap-100 align-items-center padding-50 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="group-row">
              <div className="flex-grow-100" style={{ minWidth: 0 }}>
                <span className="font-weight-500">{group.name}</span>
                <p className="margin-0 color-gray white-space-nowrap text-overflow-ellipsis overflow-hidden">
                  {t("pages:org_groups.member_count", { count: group.memberIds.length })}
                  {group.memberIds.length > 0
                    ? ` · ${group.memberIds.map(id => usernames.get(id)).filter(Boolean).join(", ")}`
                    : null}
                </p>
              </div>
              <button type="button" data-testid="group-edit" onClick={() => setEditingGroupId(group.id)}>
                {t("common:tsx.edit")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
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
    <ul className="margin-0 padding-0" style={{ listStyle: 'none', maxWidth: '30rem' }}>
      {management.members.map(member => {
        // One's own role is locked (an org shouldn't manage away its last manager
        // by accident), and guest status is a different relationship, not a rank
        const locked = member.membershipId === management.selfMembershipId || member.role === OrgRole.GUEST;
        return (
          <li key={member.membershipId} className="flex gap-100 align-items-center margin-block-25 font-size-14px" data-testid="member-row">
            <span className="flex-grow-100 white-space-nowrap text-overflow-ellipsis overflow-hidden">
              {member.username}
              {/* Proper members are home here — nothing to annotate. Guests show where
                  they come from, or that they have no home org at all. */}
              {member.role === OrgRole.GUEST ? (
                <small className="color-gray"> {member.homeOrgs.length > 0
                  ? t("pages:org_groups.home_org", { orgs: member.homeOrgs.join(", ") })
                  : t("pages:org_groups.home_org_none")}</small>
              ) : null}
            </span>
            {member.role === OrgRole.GUEST ? (
              <span className="color-gray">{roleLabel(member.role, t)}</span>
            ) : (
              <select
                style={{ padding: '.25rem .5rem' }}
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
  onClose,
}: {
  group: OrgManagement["groups"][number],
  members: OrgManagement["members"],
  onClose: () => void,
}) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState(group.name);
  const [selected, setSelected] = useState<string[]>(group.memberIds);
  // Deleting takes two clicks: the first arms the button, the second deletes
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function save(event: React.SyntheticEvent<HTMLFormElement>) {
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
        <button type="button" disabled={isLoading} data-testid="group-cancel" onClick={onClose}>
          {t("common:tsx.cancel")}
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

  function create(event: React.SyntheticEvent<HTMLFormElement>) {
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
