import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import HistoricalData from "@/components/form/forms/historicalData";
import { getOneGoal } from "@/fetchers";
import { buildMetadata } from "@/functions/buildMetadata";
import serveTea from "@/lib/i18nServer";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";

export async function generateMetadata(props: {
  params: Promise<{ goalId: string }>,
  searchParams: Promise<{
    secondaryGoal?: string | string[] | undefined,
    [key: string]: string | string[] | undefined
  }>,
}) {
  const params = await props.params;

  const [t, session, goal] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    getOneGoal(params.goalId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/goal/${params.goalId}`,
      og_image_url: '/images/og_wind.png'
    })
  }

  return buildMetadata({
    title: goal?.name,
    description: goal?.description,
    og_url: `/goal/${params.goalId}`,
    og_image_url: undefined, // TODO: Use graph api here once ready 
  })
}

export default async function page(
  props: {
    params: Promise<{ goalId: string }>,
    searchParams: Promise<{
      secondaryGoal?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>,
  }
) {
  const [params] = await Promise.all([
    props.params,
    // props.searchParams, // TODO: use?
  ]);

  const [t, goal] = await Promise.all([
    serveTea(["pages", "components"]),
    getOneGoal(params.goalId)
  ]);

  if (!goal) {
    return null;
  }

  return (
    <>
      <Breadcrumb object={goal} customSections={[t("pages:historical_data.breadcrumb")]} />
        <main className="container-text margin-inline-auto">
          <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}> {/* TODO: would like this to also say which goal i am editing for */}
            {t("components:query_builder.edit_historical_data")}
          </h1>
          <HistoricalData goal={goal} />
        </main>
    </>
  )
}