import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { LikedGoalList } from "@/components/pages/sections/likedGoals";
import { getLikeArea, getLikedGoalsInArea } from "@/fetchers/getGoalLikes";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { buildMetadata } from "@/functions/buildMetadata";
import serveTea from "@/lib/i18nServer";
import { GeoAreaType } from "@/lib/prisma/generated";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ areaCode: string }> }): Promise<Metadata> {
  const [t, params] = await Promise.all([serveTea("metadata"), props.params]);
  return await buildMetadata({
    title: t("metadata:likes_area.title"),
    description: undefined,
    og_url: `/likes/${params.areaCode}`,
    og_image_url: undefined,
  });
}

/**
 * The likes overview of a municipality or county: the goals liked by the
 * members of every org placed there (a county pools its municipalities),
 * ranked, with how many orgs stand behind each and the kinds of rådighet the
 * likes name. For signed-in members of one of those orgs (the proxy sends
 * anonymous visitors to the login); everyone else gets a 404.
 */
export default async function Page(props: {
  params: Promise<{ areaCode: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>,
}) {
  const [params, searchParams, t, accessContext] = await Promise.all([
    props.params,
    props.searchParams,
    serveTea(["pages", "common"]),
    getUserAccessContext(),
  ]);
  const area = await getLikeArea(params.areaCode);
  if (!area || !accessContext) notFound();

  const goals = await getLikedGoalsInArea(area.code);
  const memberOf = new Set(accessContext.memberships.map(membership => membership.orgId));
  // A county links to the municipalities whose overviews the viewer may open too
  const municipalities = area.municipalities.filter(municipality => accessContext.isSuperAdmin
    || area.orgs.some(org => org.geoAreaCode === municipality.code && memberOf.has(org.id)));
  const path = `/likes/${area.code}`;

  return (
    <>
      <Breadcrumb customSections={[t("pages:likes_area.breadcrumb"), area.name]} />

      <main className="padding-bottom-500">
        <h1 className="margin-block-300 padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>
          {area.type === GeoAreaType.COUNTY
            ? t("pages:likes_area.heading", { area: area.name })
            : t("pages:likes_area.heading_municipality", { area: area.name })}
        </h1>
        <p className="margin-top-0 margin-bottom-100" style={{ maxWidth: '70ch' }}>
          {area.type === GeoAreaType.COUNTY
            ? t("pages:likes_area.description_county", { area: area.name })
            : t("pages:likes_area.description", { area: area.name })}
        </p>

        <details className="margin-bottom-100" data-testid="likes-area-orgs">
          <summary className="font-weight-500">{t("pages:likes_area.orgs", { count: area.orgs.length })}</summary>
          <ul className="margin-block-50">
            {area.orgs.map(org => <li key={org.id}>{org.name}</li>)}
          </ul>
        </details>

        {area.parent || municipalities.length > 0 ?
          <nav className="flex gap-50 flex-wrap-wrap align-items-center margin-bottom-200 font-size-14px" aria-label={t("pages:likes_area.related")} data-testid="likes-area-related">
            <span className="color-gray">{t("pages:likes_area.related")}:</span>
            {area.parent ?
              <Link href={`/likes/${area.parent.code}`} data-area={area.parent.code}>{t("pages:likes_area.county_link", { area: area.parent.name })}</Link>
              : null}
            {municipalities.map(municipality => (
              <Link key={municipality.code} href={`/likes/${municipality.code}`} data-area={municipality.code}>{municipality.name}</Link>
            ))}
          </nav>
          : null}

        <h2 className="margin-top-0 margin-bottom-50 font-weight-600">{t("pages:likes_area.goals_title")}</h2>
        <LikedGoalList
          goals={goals}
          path={path}
          searchParams={searchParams}
          orgId={null}
          canCreateGoals={false}
          showOrgCount={true}
          emptyText={t("pages:home.liked_goals.empty_area", { area: area.name })}
        />
      </main>
    </>
  );
}
