import { getOneAction } from "@/fetchers";
import { ActionFieldHeaders, actionFieldLabel, getActionDescription, groupActionFields } from "@/functions/fields";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { getSession } from "@/lib/session";
import { ActionFieldType, OrgRole } from "@/lib/prisma/generated";
import { cookies } from "next/headers";
import Link from "next/link";
import { IconWorld } from "@tabler/icons-react";
import { notFound } from "next/navigation";
import { AccessLevel } from "@/types/enums";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import Comments from "@/components/comments/comments";
import EffectTable from "@/components/tables/effects";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { AdminPanel } from "@/components/elements/controls/controls";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ actionId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const [t, session, action] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneAction(params.actionId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/action/${params.actionId}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: action?.name,
    description: getActionDescription(action?.fields),
    og_url: `/action/${params.actionId}`,
    og_image_url: undefined,
  });

}

export default async function Page(props: { params: Promise<{ actionId: string }> }) {
  const params = await props.params;
  const [t, accessContext, action] = await Promise.all([
    serveTea(["pages", "forms"]),
    getUserAccessContext(),
    getOneAction(params.actionId),
  ]);

  let accessLevel: AccessLevel = AccessLevel.None;
  if (action) {
    if (action.roadmap_iteration) {
      accessLevel = accessChecker({
        access_control: action.roadmap_iteration.roadmap.access_control,
        status: action.roadmap_iteration.status,
      }, accessContext);
    } else if (accessContext?.isSuperAdmin) {
      accessLevel = AccessLevel.Admin;
    } else if (accessContext?.memberships.some(membership => membership.orgId === action.org_id && membership.role === OrgRole.MANAGER)) {
      // Roadmapless actions (the public action database) are editable by the owning org's managers
      accessLevel = AccessLevel.Edit;
    } else {
      // Roadmapless actions are visible to everyone
      accessLevel = AccessLevel.View;
    }
  }

  // 404 if the action doesn't exist or if the user doesn't have access to it
  if (!accessLevel || !action) {
    return notFound();
  }

  // Tags are TAG-headed fields but render as cards under the title rather than as a field group.
  // Sorted alphabetically since the rows come back from the database in arbitrary order.
  const tags = action.fields.filter(field => field.header === ActionFieldHeaders.Tag).map(field => field.value).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Breadcrumb object={action} />
      {hasEditAccess(accessLevel) &&
        <AdminPanel accessLevel={accessLevel} object={action} />
      }

      <main>
        <section className="margin-block-300 container">
          <span style={{ color: 'gray' }}>{t("pages:action.action_label")}</span>
          <h1 className="margin-0">{action.name}</h1>
          {tags.length > 0 &&
            <ul className="flex gap-25 margin-block-25 padding-0" style={{ listStyle: 'none', flexWrap: 'wrap' }}>
              {tags.map(tag => (
                <li key={tag} className="smooth" style={{ backgroundColor: 'var(--seagreen-90)', border: '1px solid var(--seagreen-80)' }}>
                  <Link
                    href={`/actions?tag=${encodeURIComponent(tag)}`}
                    className="discrete-link block padding-inline-50 padding-block-25"
                    style={{ color: 'var(--seagreen-30)' }}
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          }
          <p className="margin-top-0 margin-bottom-100">{action.start_year} - {action.end_year}</p>
          {/* Roadmapless actions follow no roadmap's sharing: say so, since nothing else on the page does */}
          {!action.roadmap_iteration ?
            <span className="inline-flex align-items-center gap-25 margin-bottom-100" style={{ color: 'gray' }} data-testid="sharing-line">
              <IconWorld aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
              {t("pages:action.shared_database_note")}
            </span>
            : null}
        </section>

        <section className="margin-block-300">
          {/* Fields sharing a header form one group; repeated non-paragraph values collapse into a list.
              Tags are excluded here since they already render under the title. */}
          {groupActionFields(action.fields).filter(group => group.header !== ActionFieldHeaders.Tag).map(group => (
            <div key={group.header}>
              <h2 className="margin-top-300">{actionFieldLabel(group.header, t)}</h2>
              {group.values.length > 1 && group.type !== ActionFieldType.PARAGRAPH ? (
                <ul>
                  {group.values.map((value, index) => <li key={index}>{value}</li>)}
                </ul>
              ) : (
                group.values.map((value, index) => <p key={index}>{value}</p>)
              )}
            </div>
          ))}
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:action.effects_label")}</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            <Link href={`/effect/create?actionId=${action.id}`} className="button color-purewhite pureblack round font-weight-bold">{t("pages:action.create_new_effect")}</Link>
          </menu>
          <EffectTable object={action} accessLevel={accessLevel} />
        </section>
      </main>

      <section className="margin-block-500">
        <Comments comments={action.comments} objectId={action.id} />
      </section>
    </>
  );
}
