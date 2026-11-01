'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import formSubmitter from "@/functions/formSubmitter";
import { useToast } from "@/components/generic/toast/toastContext.use";
import SelectMultipleSearch from "@/components/form/elements/combobox/selectMultipleSearch";
import SelectSingleSearch from "@/components/form/elements/combobox/selectSingleSearch";
import ListFilter, { matchesFilter } from "@/components/form/filters/listFilter";
import areaCodes from "@/lib/areaCodes.json" with { type: "json" };
import { areaSorter } from "@/lib/sorters";
import type { Option } from "@/components/types";
import type { OrgManagement } from "@/fetchers/getOrgManagement";
import { OrgRole } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

/** Section headings stay in view while their long lists scroll by */
const headingClass = "font-size-125 position-sticky padding-block-50 margin-bottom-0 neutral-background";
const headingStyle: React.CSSProperties = { top: 0, zIndex: 1 };

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

/** A member as a combobox option, searchable by name. Plain members get no
 * suffix: "(Member)" reads too much like "(Manager)" at a glance, and it's the
 * overwhelmingly common case anyway. */
function memberOption(member: OrgManagement["members"][number], t: TFunction): Option {
  return {
    name: member.role === OrgRole.MEMBER ? member.name : `${member.name} (${roleLabel(member.role, t)})`,
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
          <h2 className={headingClass} style={headingStyle}>{t("pages:org_groups.org_heading")}</h2>
          {/* Keyed on the name so a router.refresh() after renaming remounts with fresh data */}
          <RenameOrg key={management.org.name} org={management.org} />
          {/* Keyed on the area for the same reason */}
          <OrgArea key={management.org.geoAreaCode ?? "none"} org={management.org} />
        </section>

        <section className="margin-bottom-300">
          <h2 className={headingClass} style={headingStyle}>{t("pages:org_groups.members_heading")}</h2>
          <details data-testid="members-details">
            <summary className="padding-block-25" style={{ cursor: 'pointer' }}>
              {t("pages:org_groups.member_count", { count: management.members.length })}
            </summary>
            <MemberRoles management={management} />
          </details>
        </section>

        <section>
          <h2 className={headingClass} style={headingStyle}>{t("pages:org_groups.groups_heading")}</h2>
          <GroupList management={management} />
          <CreateGroup orgId={management.org.id} members={management.members} />
        </section>
    </>
  );
}

/** Text input to rename the org; the save button stays disabled until the name actually changes */
function RenameOrg({ org }: { org: OrgManagement["org"] }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState(org.name);
  const [isLoading, setIsLoading] = useState(false);

  const unchanged = name.trim() === org.name || !name.trim();

  function rename(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    formSubmitter('/api/org', JSON.stringify({
      orgId: org.id,
      name: name.trim(),
    }), 'PUT', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.renamed_toast", { name: name.trim() }), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <form onSubmit={rename} className="flex gap-50 flex-wrap-wrap align-items-flex-end" data-testid="org-rename-form">
      <label className="font-weight-500">
        {t("pages:org_groups.org_name_label")}
        <input
          className="margin-top-25 block"
          type="text"
          required={true}
          data-testid="org-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className="seagreen color-purewhite" disabled={isLoading || unchanged} data-testid="org-rename-save">
        {t("common:tsx.save")}
      </button>
    </form>
  );
}

/** The areas an org can be placed in, by name; the nation isn't a place to gather an area's organizations in */
const areaOptions: Option[] = Object.entries(areaCodes)
  .filter(([, code]) => code !== "00")
  .sort((a, b) => areaSorter([a[0], a[1]], [b[0], b[1]]))
  .map(([name, code]) => ({ name, value: code }));

/**
 * Places the org in a municipality or county. The org landing localizes its
 * statistics to the area, and the likes of all organizations placed in the
 * same area can be compiled together there.
 */
function OrgArea({ org }: { org: OrgManagement["org"] }) {
  const { t } = useTranslation(["pages", "common", "forms"]);
  const { addToast } = useToast();
  const router = useRouter();

  const [code, setCode] = useState(org.geoAreaCode ?? "");
  const [isLoading, setIsLoading] = useState(false);

  const current = areaOptions.find(option => option.value === org.geoAreaCode);
  const unchanged = code === (org.geoAreaCode ?? "");

  function save(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    formSubmitter('/api/org', JSON.stringify({
      orgId: org.id,
      geoAreaCode: code || null,
    }), 'PUT', t, setIsLoading, undefined, () => {
      setIsLoading(false);
      addToast(t("pages:org_groups.area_saved_toast"), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <form onSubmit={save} className="margin-top-100" data-testid="org-area-form">
      <label className="font-weight-500" htmlFor="org-area">{t("pages:org_groups.area_label")}</label>
      <p className="margin-block-25 color-gray font-size-14px">{t("pages:org_groups.area_description")}</p>
      <div className="flex gap-50 flex-wrap-wrap align-items-flex-end">
        <SelectSingleSearch
          props={{
            id: "org-area",
            name: "org-area",
            placeholder: t("forms:combobox.select_or_leave"),
          }}
          defaultValue={current ?? false}
          options={[{ name: t("pages:org_groups.area_none"), value: "" }, ...areaOptions]}
          onChange={(option) => setCode(option?.value ?? "")}
        />
        <button type="submit" className="seagreen color-purewhite" disabled={isLoading || unchanged} data-testid="org-area-save">
          {t("common:tsx.save")}
        </button>
      </div>
    </form>
  );
}

/** The org's groups as one-line rows (name + member count) that unfold their members; one at a time turns into an editor */
function GroupList({ management }: { management: OrgManagement }) {
  const { t } = useTranslation(["pages", "common"]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  if (management.groups.length === 0) {
    return <p className="margin-block-100">{t("pages:org_groups.no_groups")}</p>;
  }

  const names = new Map(management.members.map(member => [member.membershipId, member.name]));
  // By its name or a member's, so "which groups is Anna in?" has an answer too
  const shown = management.groups.filter(group => group.id === editingGroupId
    || matchesFilter(filter, group.name, ...group.memberIds.map(id => names.get(id) ?? "")));

  return (
    <>
      <ListFilter
        className="margin-block-100"
        style={{ maxWidth: '30rem' }}
        aria-label={t("pages:org_groups.filter_groups")}
        placeholder={t("pages:org_groups.filter_groups")}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        data-testid="group-filter"
      />
      {shown.length === 0 ? <p className="margin-block-100">{t("pages:org_groups.no_matches")}</p> : null}
      <ul className="margin-0 padding-0" style={{ listStyle: 'none' }}>
        {shown.map(group => (
          <li key={group.id} data-group-id={group.id}>
            {group.id === editingGroupId ? (
              // Keyed on content so a router.refresh() after saving remounts with fresh data
              <GroupEditor
                key={`${group.id}:${group.name}:${group.memberIds.join(',')}`}
                group={group}
                members={management.members}
                onClose={() => setEditingGroupId(null)}
              />
            ) : (
              <div className="flex gap-100 align-items-flex-start padding-block-50" style={{ borderBottom: '1px solid var(--gray-80)' }} data-testid="group-row">
                {/* One line per group; the members only on demand */}
                <details className="flex-grow-100" style={{ minWidth: 0 }}>
                  <summary className="padding-block-25" style={{ cursor: 'pointer' }}>
                    <span className="font-weight-500">{group.name}</span>
                    <span className="color-gray"> · {t("pages:org_groups.member_count", { count: group.memberIds.length })}</span>
                  </summary>
                  {group.memberIds.length > 0 ? (
                    <ul
                      className="grid margin-0 margin-block-50 padding-0 font-size-14px gap-25"
                      style={{ listStyle: 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', paddingInlineStart: '1rem' }}
                      data-testid="group-members"
                    >
                      {group.memberIds.map(id => names.get(id)).filter(name => name != null)
                        .sort((a, b) => a.localeCompare(b, "sv-SE"))
                        .map((name, index) => <li key={index}>{name}</li>)}
                    </ul>
                  ) : (
                    <p className="margin-0 margin-block-50 font-size-14px color-gray" style={{ paddingInlineStart: '1rem' }}>{t("pages:org_groups.no_group_members")}</p>
                  )}
                </details>
                <button type="button" className="flex-shrink-0" data-testid="group-edit" onClick={() => setEditingGroupId(group.id)}>
                  {t("common:tsx.edit")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Per-member role select: managers promote members to managers and demote them back */
function MemberRoles({ management }: { management: OrgManagement }) {
  const { t } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const shown = management.members.filter(member => matchesFilter(filter, member.name, member.username));

  function setRole(member: OrgManagement["members"][number], role: string) {
    formSubmitter('/api/org-membership', JSON.stringify({
      membershipId: member.membershipId,
      role,
    }), 'PUT', t, setIsLoading, undefined, () => {
      addToast(t("pages:org_groups.role_updated_toast", { name: member.name }), "success");
      router.refresh();
    }, (err) => {
      setIsLoading(false);
      addToast(errorMessage(err, t), "error");
    }, addToast);
  }

  return (
    <>
      <ListFilter
        className="margin-block-50"
        style={{ maxWidth: '30rem' }}
        aria-label={t("pages:org_groups.filter_members")}
        placeholder={t("pages:org_groups.filter_members")}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        data-testid="member-filter"
      />
      {shown.length === 0 ? <p className="margin-block-50">{t("pages:org_groups.no_matches")}</p> : null}
      <ul className="margin-0 padding-0" style={{ listStyle: 'none', maxWidth: '30rem' }}>
        {shown.map(member => {
          // One's own role is locked (an org shouldn't manage away its last manager
          // by accident), and guest status is a different relationship, not a rank
          const locked = member.membershipId === management.selfMembershipId || member.role === OrgRole.GUEST;
          return (
            <li key={member.membershipId} className="flex gap-100 align-items-center margin-block-25 font-size-14px" data-testid="member-row">
              <span className="flex-grow-100 white-space-nowrap text-overflow-ellipsis overflow-hidden">
                {member.name}
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
    </>
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
    <form onSubmit={save} className="margin-block-100 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }} data-testid="group-editor" data-group-id={group.id}>
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
