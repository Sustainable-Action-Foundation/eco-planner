import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import CuratedHistoricalGraph from "@/components/graph/graphs/curatedHistoricalGraph";
import { sourceAttribution } from "@/components/pages/sections/historicalData";
import UseSeriesActions from "@/components/pages/sections/useSeriesActions";
import { getUserOrgs } from "@/fetchers";
import { getCuratedHistoricalEntry } from "@/fetchers/getCuratedHistoricalData";
import { buildMetadata } from "@/functions/buildMetadata";
import { getCuratedHistoricalCatalog } from "@/lib/curatedHistoricalData";
import serveTea from "@/lib/i18nServer";
import type { CuratedHistoricalEntryData } from "@/fetchers/getCuratedHistoricalData";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/*
 * A browsable historical series' own page: the org landing page's curated
 * cards link here. Shows the entry in full and offers ways to use it (see
 * `UseSeriesActions`). A data lab publishing series of its own would give them
 * a page like this one.
 */

export async function generateMetadata(props: { params: Promise<{ orgId: string, entryKey: string }> }): Promise<Metadata> {
  const [t, params] = await Promise.all([serveTea(["metadata", "pages"]), props.params]);
  const name = getCuratedHistoricalCatalog(t, "").entries.find(entry => entry.key === params.entryKey)?.name;
  return await buildMetadata({
    title: name ? t("metadata:org_historical_data.title", { name }) : undefined,
    description: undefined,
    og_url: `/org/${params.orgId}/historical-data/${params.entryKey}`,
    og_image_url: undefined,
  });
}

export default async function Page(props: { params: Promise<{ orgId: string, entryKey: string }> }) {
  const params = await props.params;
  const [t, userOrgs] = await Promise.all([
    serveTea(["pages", "common"]),
    getUserOrgs(),
  ]);

  // Only the orgs the user can land on; the series are localized to the org's area
  const org = userOrgs.find(org => org.id === params.orgId);
  if (!org?.geoArea) {
    notFound();
  }

  const entry = await getCuratedHistoricalEntry(t, org.geoArea, params.entryKey);
  if (!entry) {
    notFound();
  }

  return (
    <>
      <Breadcrumb customSections={[{ link: `/?org=${org.id}`, linkText: org.name }, entry.name]} />

      <main className="padding-bottom-500">
        <h1 className="margin-top-300 margin-bottom-0">{entry.name}</h1>
        <p className="margin-top-25 margin-bottom-200 color-gray">
          {t("pages:org_historical_data.subtitle", { area: org.geoArea.name })}
        </p>

        <p className="margin-block-100">{entry.description}</p>

        <CuratedHistoricalGraph
          series={entry.series.map(series => ({ name: series.name, dateValues: series.dateValues }))}
          unit={entry.unit}
          height={entry.series.length > 1 ? 460 : 400}
        />
        <small className="block color-gray margin-top-50">
          {t("pages:home.curated_historical.source")}: {sourceAttribution(entry)}
        </small>

        <UseSeriesActions
          orgId={org.id}
          entryKey={entry.key}
          series={entry.series.map(series => ({ key: series.key, name: series.name }))}
        />

        <details className="margin-block-100">
          <summary className="font-weight-500" style={{ cursor: 'pointer' }}>{t("pages:org_historical_data.values")}</summary>
          <ValuesTable entry={entry} />
        </details>
      </main>
    </>
  );
}

/** Every period any series has a value for, one column per series. */
function ValuesTable({ entry }: { entry: CuratedHistoricalEntryData }) {
  const dates = [...new Set(entry.series.flatMap(series => Object.keys(series.dateValues)))].sort();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="margin-top-50" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th className="text-align-left padding-25" scope="col" />
            {entry.series.map(series => (
              <th key={series.key} className="text-align-right padding-25" scope="col">
                {series.name}{entry.unit ? ` (${entry.unit})` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => (
            <tr key={date} style={{ borderTop: '1px solid var(--gray-80)' }}>
              <th className="text-align-left padding-25 font-weight-500" scope="row">{date}</th>
              {entry.series.map(series => (
                <td key={series.key} className="text-align-right padding-25">
                  {series.dateValues[date as keyof typeof series.dateValues]?.toLocaleString("sv-SE") ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
