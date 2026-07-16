"use client";

import mathjs from "@/math";
import type { UnitString } from "@/types";
import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";

/**
 * Text input for overriding the unit derived from a recipe context evaluation.
 *
 * The effective unit is:
 * 1) explicit override (if provided), otherwise
 * 2) evaluated recipe unit, otherwise
 * 3) optional saved fallback unit.
 */
export function UnitInput({
  staticProvidedUnit,
  allowOverrideSelection = true,
}: {
  staticProvidedUnit?: string | null;
  allowOverrideSelection?: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const { recipe, resultingUnit, applyRecipeUpdate } = useRecipe();

  const [isOverrideToggled, setIsOverrideToggled] = useState<boolean>(recipe.unit !== undefined);
  const [overrideUnitInput, setOverrideUnitInput] = useState<string>(recipe.unit ?? "");

  const resolvedUnit: string | null = resultingUnit ?? staticProvidedUnit ?? null;
  const resolvedDisplay = resolvedUnit === null
    ? t("common:tsx.unitless")
    : resolvedUnit.trim() || t("common:tsx.unit_missing");

  const effectiveUnit: string | null = isOverrideToggled ? overrideUnitInput : resolvedUnit;

  // Normalized mathjs interpretation of the effective unit; null when it cannot be parsed.
  const parsedEffectiveUnit = useMemo(() => {
    if (typeof effectiveUnit !== "string" || effectiveUnit.trim() === "") return null;
    try {
      return mathjs.unit(effectiveUnit.trim()).toString();
    } catch {
      return null;
    }
  }, [effectiveUnit]);

  const interpretedDisplay = effectiveUnit === null
    ? t("common:tsx.unitless")
    : effectiveUnit.trim() === ""
      ? t("common:tsx.unit_missing")
      : parsedEffectiveUnit;

  const setRecipeUnit = useCallback((nextUnit: UnitString) => {
    void applyRecipeUpdate((current) => {
      const normalizedNextUnit: UnitString = typeof nextUnit === "string"
        ? nextUnit.trim()
        : nextUnit;

      if (current.unit === normalizedNextUnit) {
        return current;
      }

      const updated = current.copy();
      updated.unit = normalizedNextUnit;
      return updated;
    });
  }, [applyRecipeUpdate]);

  const handleOverrideToggle = useCallback((checked: boolean) => {
    setIsOverrideToggled(checked);

    if (!checked) {
      setRecipeUnit(undefined);
      return;
    }

    // Seed the override from the unit currently in effect, so toggling it on is a no-op until edited.
    const seededUnit = overrideUnitInput || (resolvedUnit ?? "");
    setOverrideUnitInput(seededUnit);
    setRecipeUnit(seededUnit);
  }, [overrideUnitInput, resolvedUnit, setRecipeUnit]);

  return (
    <div className="width-100 min-width-0 margin-top-50">
      <p className="font-weight-bold margin-bottom-25">
        {t("forms:data_series_input.data_unit")}
      </p>

      {/* Mathjs interpretation of the effective unit */}
      <p className="margin-bottom-25">
        {interpretedDisplay !== null
          ? <Trans
            i18nKey="forms:data_series_input.unit_interpreted_as"
            values={{ unit: interpretedDisplay }}
            components={{ a: <strong /> }}
          />
          : t("forms:data_series_input.unit_not_interpreted")}
      </p>

      {/* Toggle override */}
      {!!allowOverrideSelection && <>
        <label>
          <input
            type="checkbox"
            onChange={(e) => { handleOverrideToggle(e.target.checked); }}
            checked={isOverrideToggled}
            className="margin-right-25"
          />
          {t("forms:data_series_input.unit_input.override_toggle")}
        </label>
        {isOverrideToggled ?
          <label className="block margin-top-25">
            <input
              type="text"
              className="margin-inline-25"
              placeholder={resolvedDisplay}
              value={overrideUnitInput}
              onChange={(e) => {
                setOverrideUnitInput(e.target.value);
                setRecipeUnit(e.target.value);
              }}
            />
          </label> : null}
      </>}

      {/* Final "using" */}
      <p>
        {isOverrideToggled
          ? <Trans
            i18nKey={"forms:data_series_input.unit_override_status.overriding"}
            values={{
              resolvedUnit: resolvedDisplay,
              overrideUnit: overrideUnitInput.trim() || t("common:tsx.unit_missing"),
            }}
            components={{ a: <strong /> }}
          />
          : <Trans
            i18nKey={"forms:data_series_input.unit_override_status.using"}
            values={{ unit: resolvedDisplay }}
            components={{ a: <strong /> }}
          />
        }
      </p>
    </div>
  );
}
