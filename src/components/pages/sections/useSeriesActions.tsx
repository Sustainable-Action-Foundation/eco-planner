"use client";

import { formatSeriesRef, SeriesRefKind } from "@/lib/seriesRef";
import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The ways a browsable historical series can be put to use: today, starting
 * a new goal with it. Multi-series entries get a picker, since a goal takes
 * one series. The links carry the choice as a series ref (see `seriesRef`)
 * for the goal form to resolve, so this panel stays free of the data itself.
 */
export default function UseSeriesActions({
  orgId,
  entryKey,
  series,
}: {
  orgId: string;
  entryKey: string;
  series: { key: string, name: string }[];
}) {
  const { t } = useTranslation("pages");
  const [seriesKey, setSeriesKey] = useState(series[0]?.key ?? "");

  if (!series.length) return null;

  const ref = encodeURIComponent(formatSeriesRef({ kind: SeriesRefKind.Curated, entryKey, seriesKey }));
  const org = encodeURIComponent(orgId);

  return (
    <section className="margin-block-200 padding-100 smooth" style={{ border: '1px solid var(--gray-80)' }}>
      <h2 className="margin-top-0 margin-bottom-50 font-weight-600" style={{ fontSize: '1.25rem' }}>
        {t("pages:org_historical_data.use_heading")}
      </h2>
      <p className="margin-top-0 margin-bottom-100 color-gray">{t("pages:org_historical_data.use_description")}</p>

      {series.length > 1 ?
        <fieldset className="margin-bottom-100 radio-group fieldset-unset-pseudo-class">
          <legend className="margin-bottom-25 font-weight-500">{t("pages:org_historical_data.series_legend")}</legend>
          {series.map(option => (
            <label key={option.key} className="flex align-items-center gap-50 margin-bottom-25">
              <input
                type="radio"
                name="series"
                value={option.key}
                checked={seriesKey === option.key}
                onChange={() => setSeriesKey(option.key)}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
        : null}

      <ul className="margin-0 padding-0 flex flex-direction-column gap-75" style={{ listStyle: 'none' }}>
        <li>
          <Link className="button round color-purewhite pureblack font-weight-500 display-inline-flex align-items-center gap-50" href={`/goal/create?org=${org}&historical=${ref}`}>
            {t("pages:org_historical_data.use_as_historical")}
            <IconArrowRight aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          </Link>
          <p className="margin-top-25 margin-bottom-0 font-size-14px color-gray">{t("pages:org_historical_data.use_as_historical_description")}</p>
        </li>
        <li>
          <Link className="button round purewhite font-weight-500 display-inline-flex align-items-center gap-50" href={`/goal/create?org=${org}&dataSeries=${ref}`}>
            {t("pages:org_historical_data.use_as_data_series")}
            <IconArrowRight aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          </Link>
          <p className="margin-top-25 margin-bottom-0 font-size-14px color-gray">{t("pages:org_historical_data.use_as_data_series_description")}</p>
        </li>
      </ul>
    </section>
  );
}
