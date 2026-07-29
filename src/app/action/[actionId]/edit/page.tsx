import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import ActionForm from "@/components/form/forms/action";
import { notFound } from "next/navigation";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getOneAction } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { OrgRole } from "@/lib/prisma/generated";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
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
      og_url: `/goal/${params.actionId}/edit`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: `${t("metadata:action_edit.title")} ${action?.name}`,
    description: action?.fields[0]?.value,
    og_url: `/goal/${params.actionId}/edit`,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: {
    params: Promise<{ actionId: string }>,
  },
) {
  const params = await props.params;
  const [t, accessContext, action] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneAction(params.actionId),
  ]);

  let mayEdit = false;
  if (action && accessContext) {
    mayEdit = action.roadmap_iteration
      ? hasEditAccess(accessChecker({
        access_control: action.roadmap_iteration.roadmap.access_control,
        published_at: action.roadmap_iteration.published_at,
      }, accessContext))
      // Roadmapless actions (the public action database) are editable by the owning org's managers
      : (accessContext.isSuperAdmin || accessContext.memberships.some(membership => membership.orgId === action.org_id && membership.role === OrgRole.MANAGER));
  }

  // User must be signed in and have edit access to the action, and the action must exist
  if (!action || !accessContext || !mayEdit) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={action} customSections={[t("pages:action_edit.breadcrumb")]} />

      <div className="container-text margin-inline-auto">
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:action_edit.title", {
            actionName: action.name,
            roadmapName: action.roadmap_iteration?.roadmap.name,
            version: action.roadmap_iteration?.version,
          })}
        </h1>
        <ActionForm iterationId={action.roadmap_iteration_id ?? undefined} currentAction={action} roadmaps={[]} />
      </div>
    </>
  );
}
