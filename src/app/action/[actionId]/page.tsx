import { getOneAction }from "@/fetchers";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessLevel } from "@/types";
import type { AccessControlled } from "@/types";
import accessChecker from "@/lib/accessChecker";
import Comments from "@/components/comments/comments";
import EffectTable from "@/components/tables/effects";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import TextEditor from "@/components/form/elements/textEditor/editor";
import { AdminPanel } from "@/components/elements/controls/controls";

export async function generateMetadata(props: { params: Promise<{ actionId: string }> }) {
  const params = await props.params
  const [t, session, action] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneAction(params.actionId)
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/action/${params.actionId}`,
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: action?.name,
    description: action?.description,
    og_url: `/action/${params.actionId}`,
    og_image_url: undefined
  })

}

export default async function Page(props: { params: Promise<{ actionId: string }> }) {
  const params = await props.params;
  const [t, session, action] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneAction(params.actionId)
  ]);

  let accessLevel: AccessLevel = AccessLevel.None;
  if (action) {
    const actionAccessData: AccessControlled = {
      author: action.author,
      editors: action.roadmap.editors,
      viewers: action.roadmap.viewers,
      editGroups: action.roadmap.editGroups,
      viewGroups: action.roadmap.viewGroups,
      isPublic: action.roadmap.isPublic
    }
    accessLevel = accessChecker(actionAccessData, session.user);
  }

  // 404 if the action doesn't exist or if the user doesn't have access to it
  if (!accessLevel || !action) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={action} />
      {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
        <AdminPanel accessLevel={accessLevel} object={action} />
      }

      <main>
        <section className="margin-block-300 container">
          <span style={{ color: 'gray' }}>{t("pages:action.action_label")}</span>
          <h1 className="margin-0">{action.name}</h1>
          <p className="margin-top-0 margin-bottom-100">{action.startYear} - {action.endYear}</p>
          {action.description ?
            <TextEditor
              id="rich-description"
              editable={false}
              defaultStyles={false}
              content={action.description}
            />
            : null}
        </section>

        <section className="margin-block-300">
          <h2 className="margin-top-300">{t("pages:action.expected_effect")}</h2>
          {action.expectedOutcome ?
            <p>{action.expectedOutcome}</p>
            :
            <p>{t("pages:action.no_effect")}</p>
          }

          <h2 className="margin-top-300">{t("pages:action.cost_efficiency")}</h2>
          {action.costEfficiency ?
            <p>{action.costEfficiency}</p>
            :
            <p>{t("pages:action.no_cost_efficiency")}</p>
          }

          <h2 className="margin-top-300">{t("pages:action.project_manager")}</h2>
          {(action.projectManager && (accessLevel == AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel == AccessLevel.Admin)) ?
            <p>{action.projectManager}</p>
            :
            <p>{t("pages:action.no_project_manager")}</p>
          }

          <h2 className="margin-top-300">{t("pages:action.relevant_actors")}</h2>
          {action.relevantActors ?
            <p>{action.relevantActors}</p>
            :
            <p>{t("pages:action.no_actors")}</p>
          }

          <h2 className="margin-top-300">{t("pages:action.categories")}</h2>
          {(action.isEfficiency || action.isSufficiency || action.isRenewables) ? (
            <ul>
              {action.isEfficiency && <li className="margin-block-50">Efficiency</li>}
              {action.isSufficiency && <li className="margin-block-50">Sufficiency</li>}
              {action.isRenewables && <li className="margin-block-50">Renewables</li>}
            </ul>
          ) : (
            <p>{t("pages:action.no_category")}</p>
          )
          }
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
  )
}