"use client";

import CuratedHistoricalGraph from "@/components/graph/graphs/curatedHistoricalGraph";
import { copySuggestionContext, DefaultSuggestedRecipeId, isUnscaledSuggestion, preferredSuggestion, prefillForArea } from "@/components/recipe/suggestions/defaultSuggestedRecipes";
import { clientSafeGetOneDataSeries } from "@/fetchers/client";
import { getLocalStorage, setLocalStorage } from "@/functions/localStorage";
import { Recipe } from "@/functions/recipe/recipe";
import { parseUnit, serializeUnit } from "@/functions/unit";
import getTableContent from "@/lib/api/getTableContent";
import type { DateValues, GeoAreaRef, GoalPrefill } from "@/types";
import { IconInfoCircle } from "@tabler/icons-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/** Whether the preview is on is remembered between goals, so a roadmap can be read through scaled */
const STORAGE_KEY = "scaledGoalPreview";

const PreviewStatus = {
  Loading: "LOADING",
  Done: "DONE",
  Failed: "FAILED",
} as const;
type PreviewStatus = (typeof PreviewStatus)[keyof typeof PreviewStatus];

type Preview =
  | { key: string, status: typeof PreviewStatus.Loading }
  | { key: string, status: typeof PreviewStatus.Done, dateValues: DateValues, unit: string | null }
  | { key: string, status: typeof PreviewStatus.Failed, error: string };

/**
 * A goal as a copy of it would start out in one of the user's areas: the
 * method the goal form would start on (see `preferredSuggestion`), evaluated
 * here. Nothing is fetched or evaluated until the preview is turned on. A goal
 * whose method takes it as is gets a notice saying so instead of the national
 * figures under a local heading.
 */
export default function ScaledGoalPreviewToggle({ prefill, areas }: { prefill: GoalPrefill, areas: GeoAreaRef[] }) {
  const { t, i18n } = useTranslation(["pages", "components"]);
  const [enabled, setEnabled] = useState(false);
  const [areaCode, setAreaCode] = useState(areas[0]?.code ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    // After mount, since the server doesn't know the stored choice
    if (getLocalStorage(STORAGE_KEY) === true) setEnabled(true);
  }, []);

  const area = areas.find(area => area.code === areaCode) ?? areas[0];
  const { forArea, suggestion, method, invalid } = useMemo(() => {
    const forArea = prefillForArea(prefill, area);
    try {
      const suggestion = preferredSuggestion(t, copySuggestionContext(forArea, { source: prefill.sourceGeoArea ?? null, target: area }));
      return { forArea, suggestion, method: suggestion ? Recipe.from(suggestion.recipe).name : null, invalid: null };
    }
    catch (err) {
      // A suggestion the recipe type rejects (e.g. a stored one that no longer parses): the section says so rather than taking the page down
      console.error("Invalid suggested method for the scaled preview", err);
      return { forArea, suggestion: undefined, method: null, invalid: err instanceof Error ? err.message : "" };
    }
  }, [prefill, area, t]);
  const isScaled = !!suggestion && !isUnscaledSuggestion(suggestion.id);

  const key = `${area.code}:${suggestion?.id ?? ""}`;
  useEffect(() => {
    if (!enabled || !isScaled || !suggestion) return;
    let cancelled = false;
    setPreview({ key, status: PreviewStatus.Loading });
    Recipe.from(suggestion.recipe)
      .evaluate([], { externalTableContentGetter: getTableContent, dataSeriesGetter: clientSafeGetOneDataSeries })
      .then(evaluated => {
        if (cancelled) return;
        if (!evaluated) throw new Error("No result");
        setPreview({ key, status: PreviewStatus.Done, dateValues: evaluated.dateValues, unit: serializeUnit(evaluated.unit) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Failed to evaluate the scaled preview", err);
        setPreview({ key, status: PreviewStatus.Failed, error: err instanceof Error ? err.message : "" });
      });
    return () => { cancelled = true; };
  }, [enabled, isScaled, suggestion, key]);

  const current = preview?.key === key ? preview : null;
  // The local statistic is drawn with the copy when the two are in the same unit
  const history = current?.status === PreviewStatus.Done && forArea.historical?.dateValues && serializeUnit(parseUnit(forArea.historical.unit)) === current.unit
    ? forArea.historical.dateValues
    : null;
  const last = current?.status === PreviewStatus.Done ? Object.entries(current.dateValues).sort(([a], [b]) => a.localeCompare(b)).at(-1) : undefined;

  return <>
    <div className="flex gap-100 align-items-center flex-wrap-wrap">
      <label className="flex align-items-center gap-50">
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => { setEnabled(event.target.checked); setLocalStorage(STORAGE_KEY, event.target.checked); }}
          data-testid="scaled-preview-toggle"
        />
        {areas.length > 1 ? t("pages:goal.scaled_preview.toggle_any") : t("pages:goal.scaled_preview.toggle", { area: area.name })}
      </label>
      {areas.length > 1 ?
        <label className="flex align-items-center gap-50">
          {t("pages:goal.scaled_preview.area_label")}
          <select value={area.code} onChange={event => setAreaCode(event.target.value)} data-testid="scaled-preview-area">
            {areas.map(area => <option key={area.code} value={area.code}>{area.name}</option>)}
          </select>
        </label>
        : null}
    </div>

    {enabled && invalid !== null ?
      <p className="flex gap-50 align-items-center margin-top-100 margin-bottom-0" role="alert" data-testid="scaled-preview-failed">
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>{t("pages:goal.scaled_preview.failed", { error: invalid })}</span>
      </p>
      : null}

    {enabled && invalid === null && !isScaled ?
      <p className="flex gap-50 align-items-center margin-top-100 margin-bottom-0" data-testid="scaled-preview-unscaled">
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>
          {suggestion && method && suggestion.id !== DefaultSuggestedRecipeId.Scalar
            ? t("pages:goal.scaled_preview.as_is", { method, area: area.name })
            : t("pages:goal.scaled_preview.no_method", { area: area.name })}
        </span>
      </p>
      : null}

    {enabled && isScaled && (!current || current.status === PreviewStatus.Loading) ?
      <p className="flex gap-50 align-items-center margin-top-100 margin-bottom-0 color-gray" aria-live="polite">
        <Image src="/loaders/3-dots-move.svg" width={24} height={24} alt="" />
        {t("pages:goal.scaled_preview.loading")}
      </p>
      : null}

    {enabled && isScaled && current?.status === PreviewStatus.Failed ?
      <p className="flex gap-50 align-items-center margin-top-100 margin-bottom-0" role="alert" data-testid="scaled-preview-failed">
        <IconInfoCircle aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
        <span>{t("pages:goal.scaled_preview.failed", { error: current.error })}</span>
      </p>
      : null}

    {enabled && isScaled && current?.status === PreviewStatus.Done ?
      <div className="margin-top-100" data-testid="scaled-preview-result">
        <CuratedHistoricalGraph
          series={[
            ...(history ? [{ name: t("pages:goal.scaled_preview.history", { area: area.name }), dateValues: history }] : []),
            { name: t("pages:goal.scaled_preview.scaled_series", { area: area.name }), dateValues: current.dateValues, dashed: !!history },
          ]}
          unit={current.unit}
          height={320}
        />
        <p className="margin-block-25 font-size-14px color-gray">
          {method ? `${t("pages:goal.scaled_preview.method", { method })} ` : null}
          {last ?
            <strong className="font-weight-500" data-testid="scaled-preview-last-value" data-value={last[1]}>
              {t("pages:goal.scaled_preview.last_value", {
                year: new Date(last[0]).getUTCFullYear(),
                value: last[1].toLocaleString(i18n.language, { maximumFractionDigits: 2 }),
                unit: current.unit ?? "",
              })}
            </strong>
            : null}
          {` ${t("pages:goal.scaled_preview.note", { area: area.name })}`}
        </p>
      </div>
      : null}
  </>;
}
