import CuratedHistoricalGraph from "@/components/graph/graphs/curatedHistoricalGraph";
import { getCuratedHistoricalData } from "@/fetchers/getCuratedHistoricalData";
import { CuratedHistoricalCategory } from "@/lib/curatedHistoricalData";
import { ExternalDataset } from "@/lib/api/utility";
import serveTea from "@/lib/i18nServer";

/**
 * The org landing page's browsable historical data: the curated catalog fetched
 * for the org's geo area, grouped by category. Renders nothing when no entry
 * has data for the area, so callers can include it unconditionally.
 */
export default async function CuratedHistoricalData({
  geoArea,
}: {
  geoArea: { code: string, name: string },
}) {
  const t = await serveTea("pages");
  const series = await getCuratedHistoricalData(t, geoArea.code);

  if (series.length === 0) return null;

  const categoryLabels: Record<CuratedHistoricalCategory, string> = {
    [CuratedHistoricalCategory.Emissions]: t("pages:home.curated_historical.category_emissions"),
    [CuratedHistoricalCategory.Population]: t("pages:home.curated_historical.category_population"),
    [CuratedHistoricalCategory.Geography]: t("pages:home.curated_historical.category_geography"),
  };

  const categories = Object.values(CuratedHistoricalCategory)
    .map(category => ({ category, entries: series.filter(entry => entry.category === category) }))
    .filter(group => group.entries.length > 0);

  return <>
    <h2 className="margin-top-0 margin-bottom-50 font-weight-600">
      {t("pages:home.curated_historical.title", { area: geoArea.name })}
    </h2>
    <p className="margin-top-0 margin-bottom-100 color-gray">
      {t("pages:home.curated_historical.description")}
    </p>

    {categories.map(group => (
      <section key={group.category} className="margin-bottom-200">
        <h3 className="margin-bottom-50 font-weight-500" style={{ fontSize: '1.25rem' }}>
          {categoryLabels[group.category]}
        </h3>
        <ul
          className="margin-0 padding-0"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', listStyle: 'none' }}
        >
          {group.entries.map(entry => (
            <li key={entry.key} className="smooth" style={{ border: '1px solid var(--gray-80)' }}>
              <article className="padding-50 height-100 flex flex-direction-column">
                <h4 className="margin-block-25 font-weight-500">{entry.name}</h4>
                <CuratedHistoricalGraph name={entry.name} unit={entry.unit} dateValues={entry.dateValues} />
                <p className="margin-block-25 font-size-14px color-gray flex-grow-100">{entry.description}</p>
                <small className="color-gray">
                  {t("pages:home.curated_historical.source")}: {ExternalDataset.getDatasetByAlternateName(entry.dataset)?.fullName ?? entry.dataset} ({entry.tableId})
                </small>
              </article>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </>;
}
