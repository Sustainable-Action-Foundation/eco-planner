import CuratedHistoricalGraph from "@/components/graph/graphs/curatedHistoricalGraph";
import { getCuratedHistoricalData } from "@/fetchers/getCuratedHistoricalData";
import { CuratedHistoricalCategory } from "@/lib/curatedHistoricalData";
import { ExternalDataset } from "@/lib/api/utility";
import serveTea from "@/lib/i18nServer";
import type { CuratedGeoArea, CuratedHistoricalEntryData } from "@/fetchers/getCuratedHistoricalData";

/**
 * The org landing page's browsable historical data: the curated catalog fetched
 * for the org's geo area, grouped by category. Renders nothing when no entry
 * has data for the area, so callers can include it unconditionally.
 */
export default async function CuratedHistoricalData({
  geoArea,
}: {
  geoArea: CuratedGeoArea,
}) {
  const t = await serveTea("pages");
  const catalog = await getCuratedHistoricalData(t, geoArea);

  if (catalog.entries.length === 0) return null;

  const categoryLabels: Record<CuratedHistoricalCategory, string> = {
    [CuratedHistoricalCategory.WindPower]: t("pages:home.curated_historical.category_wind_power"),
    [CuratedHistoricalCategory.SolarPower]: t("pages:home.curated_historical.category_solar_power"),
    [CuratedHistoricalCategory.Vehicles]: t("pages:home.curated_historical.category_vehicles"),
  };

  const categories = Object.values(CuratedHistoricalCategory)
    .map(category => ({ category, entries: catalog.entries.filter(entry => entry.category === category) }))
    .filter(group => group.entries.length > 0);

  return <>
    <h2 className="margin-top-0 margin-bottom-50 font-weight-600">
      {catalog.title}
    </h2>
    <p className="margin-top-0 margin-bottom-100 color-gray">
      {catalog.description}
    </p>

    {/* Categories share lines when they fit (flex basis scales with card count), so
        e.g. three one-card categories render as a single row instead of stacking */}
    <div className="flex flex-wrap-wrap" style={{ gap: '1rem' }}>
      {categories.map(group => (
        <section key={group.category} style={{ flex: `1 1 ${group.entries.length * 300}px`, maxWidth: '100%' }}>
          <h3 className="margin-top-0 margin-bottom-50 font-weight-500" style={{ fontSize: '1.25rem' }}>
            {categoryLabels[group.category]}
          </h3>
          <ul
            className="margin-0 padding-0"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', listStyle: 'none' }}
          >
            {group.entries.map(entry => (
              <li key={entry.key} className="smooth" style={{ border: '1px solid var(--gray-80)' }}>
                <article className="padding-50 height-100 flex flex-direction-column">
                  <h4 className="margin-block-25 font-weight-500">{entry.name}</h4>
                  <CuratedHistoricalGraph
                    series={entry.series.map(series => ({ name: series.name, dateValues: series.dateValues }))}
                    unit={entry.unit}
                  />
                  <p className="margin-block-25 font-size-14px color-gray flex-grow-100">{entry.description}</p>
                  <small className="color-gray">
                    {t("pages:home.curated_historical.source")}: {sourceAttribution(entry)}
                  </small>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </>;
}

/** "Energimyndigheten (EN0105_3)", listing each distinct table the entry's series came from. */
function sourceAttribution(entry: CuratedHistoricalEntryData): string {
  const tables = new Map(entry.series.map(series => [`${series.source.dataset}/${series.source.tableId}`, series.source]));
  return [...tables.values()]
    .map(source => `${ExternalDataset.getDatasetByAlternateName(source.dataset)?.fullName ?? source.dataset} (${source.tableId})`)
    .join(", ");
}
