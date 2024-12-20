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

  return ( // TODO: Make sure optional stuff from form renders conditionally
    <>
      <Breadcrumb object={action} />

      <section className="margin-block-100" style={{ width: 'min(90ch, 100%)' }}>
        <span style={{ color: 'gray' }}>Åtgärd</span>
        <h1 className="margin-0">{action.name}</h1>
        <p className="margin-0">{action.startYear} - {action.endYear}</p>
        {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
          <div className="margin-block-100">
            <Link href={`/action/${params.actionId}/editAction`} className="flex align-items-center gap-50 padding-50 smooth button transparent" style={{ width: 'fit-content', fontWeight: '500' }}>
              Redigera åtgärd
              <Image src="/icons/edit.svg" width={24} height={24} alt={`Redigera åtgärd: ${action.name}`} />
            </Link>
          </div>
          : null}
      </section>

      {action.description ?
        <p>{action.description}</p>
        : null}

      {action.links.length > 0 ?
        <>
          <h2>Länkar</h2>
          {action.links.map((link) => (
            <Fragment key={link.id}>
              <a href={link.url} target="_blank">{link.description || link.url}</a>
            </Fragment>
          ))}
        </>
        : null}

      <h2>Förväntad effekt</h2>
      {action.expectedOutcome ?
        <p>{action.expectedOutcome}</p>
        : null}

      <h2>Kostnadseffektivitet</h2>
      {action.costEfficiency ?
        <p>{action.costEfficiency}</p>
        : null}

      <h2>Projektledare</h2>
      {(action.projectManager && (accessLevel == AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel == AccessLevel.Admin)) ?
        <p>{action.projectManager}</p>
        : null}

      <h2>Relevanta Aktörer</h2>
      {action.relevantActors ?
        <p>{action.relevantActors}</p>
        : null}

      <h2>Kategorier</h2>
      {(action.isEfficiency || action.isSufficiency || action.isRenewables) ?
        <p>
          {action.isEfficiency && 'Efficiency'} {(action.isEfficiency && (action.isSufficiency || action.isRenewables))}
          {action.isSufficiency && 'Sufficiency'} {(action.isSufficiency && action.isRenewables)}
          {action.isRenewables && 'Renewables'}
        </p>
        : null
      }

      <section>
        <div className="flex align-items-center justify-content-space-between">
          <h2>Effekter</h2>
          <Link href={`/effect/createEffect?actionId=${action.id}`} className="button color-purewhite pureblack round font-weight-bold">Skapa ny effekt</Link>
        </div>
        <EffectTable object={action} accessLevel={accessLevel} />
      </section>

      <Comments comments={action.comments} objectId={action.id} />
    </>
  )
}