import getOneMetaRoadmap from "@/fetchers/getOneMetaRoadmap";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoadmapTable from "@/components/tables/roadmapTables/roadmapTable";
import { TableMenu } from "@/components/tables/tableMenu/tableMenu";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { Metadata } from "next";
import { baseUrl } from "@/lib/baseUrl";

export async function generateMetadata({ params }: { params: { metaRoadmapId: string } }) {
  
  const [metaRoadmap] = await Promise.all([
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  const metadata: Metadata = {
    title: `${metaRoadmap?.name} - Eco - Planner`,
    icons: "/icons/leaf.svg",
    description: `${metaRoadmap?.description || 'Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.'}`,
    openGraph: {
      title: `${metaRoadmap?.name} - Eco - Planner`,
      type: 'website',
      url: baseUrl,
      images: [{
        url: `${baseUrl}/images/solarpanels.jpg`
      }],
      siteName: 'Eco - Planner',
      description: `${metaRoadmap?.description || 'Ett verktyg som syftar till att bidra till Sveriges klimatomställning. I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas. Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen. Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige. På lokal nivå kan också olika aktörer samarbeta kring åtgärder.'}`,
      locale: 'sv_SE'
    }
  }

  return metadata
}


export default async function Page({ params }: { params: { metaRoadmapId: string } }) {
  const [session, metaRoadmap] = await Promise.all([
    getSession(cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  const accessLevel = accessChecker(metaRoadmap, session.user);

  // 404 if the meta roadmap doesn't exist or the user doesn't have access
  if (!metaRoadmap) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={metaRoadmap} />

      <main>
        <section className="margin-block-300">
          <div className="flex gap-100 flex-wrap-wrap justify-content-space-between" style={{ fontSize: '1rem' }}>
            <div>
              <span style={{ color: 'gray' }}>Färdplansserie</span>
              <h1 className="margin-0">{metaRoadmap.name}</h1>
              <small>Metadata för en serie av färdplansversioner</small>
              <p>{metaRoadmap.description}</p>
              {metaRoadmap.links.length > 0 ?
                <>
                  <h2 className="margin-bottom-0 margin-top-200">Externa resurser</h2>
                  <ul>
                    {metaRoadmap.links.map((link: { url: string, description: string | null }, index: number) =>
                      <li className="margin-block-25" key={index}>
                        <a href={link.url} target="_blank">{link.description}</a>
                      </li>
                    )}
                  </ul>
                </>
                : null
              }
            </div>
        
            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <TableMenu
                accessLevel={accessLevel}
                object={metaRoadmap}
              />
            : null }
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>Färdplaner</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <a href={`/roadmap/create?metaRoadmapId=${metaRoadmap.id}`} className="button pureblack color-purewhite round">Skapa ny färdplansversion</a>
            : null }
          </menu>
          <RoadmapTable user={session.user} metaRoadmap={metaRoadmap} />
        </section>
      </main>
    </>
  )
}