import getOneAction from "@/fetchers/getOneAction";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AccessControlled, AccessLevel } from "@/types";
import accessChecker from "@/lib/accessChecker";
import { Fragment } from "react";
import Comments from "@/components/comments/comments";
import EffectTable from "@/components/tables/effects.tsx";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { getServerLocale, validateDict } from "@/functions/serverLocale";
import dict from "./page.dict.json" assert {type: "json"};

export default async function Page({ params }: { params: { actionId: string } }) {
  await validateDict(dict);
  const locale = await getServerLocale();

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
              <span style={{ color: 'gray' }}>{dict.summary.action[locale]}</span>
              <h1 className="margin-0">{action.name}</h1>
              <p className="margin-0">{action.startYear} - {action.endYear}</p>
              {action.description ?
                <p>{action.description}</p>
                : null}
              {action.links.length > 0 ?
                <>
                  <h2 className="margin-bottom-0 margin-top-200" style={{ fontSize: '1.25rem' }}>{dict.summary.externalResources[locale]}</h2>
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
                {dict.summary.editAction[locale]}
                <Image src="/icons/edit.svg" width={24} height={24} alt={`${dict.summary.editActionAlt[locale]}${action.name}`} />
              </Link>
              : null}
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-top-300">{dict.expectedEffects.expectedEffect[locale]}</h2>
          {action.expectedOutcome ?
            <p>{action.expectedOutcome}</p>
            :
            <p>{dict.expectedEffects.noSpecifiedEffect[locale]}</p>
          }

          <h2 className="margin-top-300">{dict.costEfficiency.costEfficiency[locale]}</h2>
          {action.costEfficiency ?
            <p>{action.costEfficiency}</p>
            :
            <p>{dict.costEfficiency.noSpecifiedCostEfficiency[locale]}</p>
          }

          <h2 className="margin-top-300">{dict.projectLeader.projectLeader[locale]}</h2>
          {(action.projectManager && (accessLevel == AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel == AccessLevel.Admin)) ?
            <p>{action.projectManager}</p>
            :
            <p>{dict.projectLeader.noSpecifiedProjectLeader[locale]}</p>
          }

          <h2 className="margin-top-300">{dict.relevantActors.relevantActors[locale]}</h2>
          {action.relevantActors ?
            <p>{action.relevantActors}</p>
            :
            <p>{dict.relevantActors.noSpecifiedRelevantActors[locale]}</p>
          }

          <h2 className="margin-top-300">{dict.categories.categories[locale]}</h2>
          {(action.isEfficiency || action.isSufficiency || action.isRenewables) ? (
            <ul>
              {action.isEfficiency && <li className="margin-block-50">{dict.categories.categoryTypes.efficiency[locale]}</li>}
              {action.isSufficiency && <li className="margin-block-50">{dict.categories.categoryTypes.sufficiency[locale]}</li>}
              {action.isRenewables && <li className="margin-block-50">{dict.categories.categoryTypes.renewables[locale]}</li>}
            </ul>
          ) : (
            <p>{dict.categories.noSpecifiedCategories[locale]}</p>
          )
          }
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{dict.effects.effects[locale]}</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            <Link href={`/effect/create?actionId=${action.id}`} className="button color-purewhite pureblack round font-weight-bold">{dict.effects.createEffect[locale]}</Link>
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