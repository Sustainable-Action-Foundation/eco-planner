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

export default async function Page(props: { params: Promise<{ actionId: string }> }) {
  const params = await props.params;
  const [session, action] = await Promise.all([
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

      <main>
        <section className="margin-block-300 container">
          <div className="flex flex-wrap-wrap">
            <div className="flex-grow-100">
              <span style={{ color: 'gray' }}>Åtgärd</span>
              <h1 className="margin-0">{action.name}</h1>
              <p className="margin-0">{action.startYear} - {action.endYear}</p>
              {action.description ?
                <p>{action.description}</p>
              : null}
              {action.links.length > 0 ?
                <>
                  <h2 className="margin-bottom-0 margin-top-200" style={{fontSize: '1.25rem'}}>Externa resurser</h2>
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
                style={{ width: 'fit-content', height: 'fit-content'}}
              >
                Redigera åtgärd
                <Image src="/icons/edit.svg" width={24} height={24} alt={`Redigera åtgärd: ${action.name}`} />
              </Link>
            : null}
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-top-300">Förväntad effekt</h2>
          {action.expectedOutcome ?
            <p>{action.expectedOutcome}</p>
          :
            <p>Ingen angiven effekt</p>   
          }

          <h2 className="margin-top-300">Kostnadseffektivitet</h2>
          {action.costEfficiency ?
            <p>{action.costEfficiency}</p>
          : 
            <p>Ingen angiven Kostnadseffektivitet</p>   
          }

          <h2 className="margin-top-300">Projektledare</h2>
          {(action.projectManager && (accessLevel == AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel == AccessLevel.Admin)) ?
            <p>{action.projectManager}</p>
          : 
            <p>Ingen angiven projektledare</p>     
          }

          <h2 className="margin-top-300">Relevanta Aktörer</h2>
          {action.relevantActors ?
            <p>{action.relevantActors}</p>
          : 
            <p>Inga angivna aktörer</p>     
          }

          <h2 className="margin-top-300">Kategorier</h2>
          {(action.isEfficiency || action.isSufficiency || action.isRenewables) ? (
              <ul>
                {action.isEfficiency && <li className="margin-block-50">Efficiency</li>}
                {action.isSufficiency && <li className="margin-block-50">Sufficiency</li>}
                {action.isRenewables && <li className="margin-block-50">Renewables</li>}
              </ul>
            ) : (
              <p>Ingen angiven kategori</p>
            )
          }
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{borderBottom: '1px solid var(--gray)'}}>Effekter</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            <Link href={`/effect/create?actionId=${action.id}`} className="button color-purewhite pureblack round font-weight-bold">Skapa ny effekt</Link>
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