import getOneAction from "@/fetchers/getOneAction";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AccessControlled, AccessLevel } from "@/types";
import accessChecker from "@/lib/accessChecker";
// import { Fragment } from "react";
import Comments from "@/components/comments/comments";
import EffectTable from "@/components/tables/effects.tsx";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { t } from "@/lib/i18nServer";

export default async function Page({ params }: { params: { actionId: string } }) {
  const [session, action] = await Promise.all([
    getSession(cookies()),
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

      <main>
        <section className="margin-block-300 container">
          <div className="flex flex-wrap-wrap">
            <div className="flex-grow-100">
              <span style={{ color: 'gray' }}>{t("pages:action.action_label")}</span>
              <h1 className="margin-0">{action.name}</h1>
              <p className="margin-0">{action.startYear} - {action.endYear}</p>
              {action.description ?
                <p>{action.description}</p>
                : null}
              {action.links.length > 0 ?
                <>
                  <h2 className="margin-bottom-0 margin-top-200" style={{ fontSize: '1.25rem' }}>{t("pages:common.external_resources")}</h2>
                  <ul>
                    {action.links.map((link: { url: string, description: string | null }, index: number) =>
                      <li className="margin-block-25" key={index}>
                        <a href={link.url} target="_blank">{link.description}</a>
                      </li>
                    )}
                  </ul>
                </>
                : null}
            </div>
            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <Link
                href={`/action/${params.actionId}/edit`}
                className="flex align-items-center gap-50 padding-block-50 padding-inline-100 round button transparent font-weight-500"
                style={{ width: 'fit-content', height: 'fit-content' }}
              >
                {t("pages:action.edit_action")}
                <Image src="/icons/edit.svg" width={24} height={24} alt={t("pages:action.edit_action_alt", { actionName: action.name })} />
              </Link>
              : null}
          </div>
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