"use client";

import mathjs from "@/math";
import type { UnitString } from "@/types";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  savedUnit,
  allowOverrideSelection = true,
}: {
  savedUnit?: string | null;
  allowOverrideSelection?: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const { recipe, resultingUnit, applyRecipeUpdate } = useRecipe();

  const expectedUnit: UnitString = recipe.unit ?? savedUnit;
  const suggestedUnitInput = typeof (resultingUnit ?? savedUnit) === "string"
    ? ((resultingUnit ?? savedUnit) as string)
    : "";
  const expectedUnitInput = typeof expectedUnit === "string"
    ? expectedUnit
    : "";

  const hasOverride = recipe.unit !== undefined;
  const effectiveUnit = hasOverride
    ? expectedUnitInput.trim()
    : suggestedUnitInput.trim();

  const comparableExpected = expectedUnit === null
    ? "__UNITLESS__"
    : expectedUnitInput.trim();
  const comparableResolved = resultingUnit === null
    ? "__UNITLESS__"
    : typeof resultingUnit === "string"
      ? resultingUnit.trim()
      : "";
  const unitsDiffer = comparableExpected !== ""
    && comparableResolved !== ""
    && comparableExpected !== comparableResolved;

  const expectedDisplay = expectedUnit === null
    ? t("common:tsx.unitless")
    : expectedUnitInput.trim() || t("common:tsx.unit_missing");
  const resolvedDisplay = resultingUnit === null
    ? t("common:tsx.unitless")
    : (typeof resultingUnit === "string" ? resultingUnit.trim() : "") || t("common:tsx.unit_missing");

  const setRecipeUnitAction = useCallback((nextUnit: UnitString) => {
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

  const parsedEffectiveUnit = useMemo(() => {
    if (!effectiveUnit) return null;
    try {
      return mathjs.unit(effectiveUnit).toString();
    } catch {
      return null;
    }
  }, [effectiveUnit]);

  const inputDisabled = allowOverrideSelection && !hasOverride;

  return (
    <div className="width-100 min-width-0 margin-top-50">
      {t("forms:data_series_input.data_unit")}

      <label className="block">
        {/* Mathjs report */}
        <small className="block margin-top-25  font-style-italic" style={{ minHeight: "20px", overflowWrap: "anywhere" }}>
          {(hasOverride && expectedUnit === null)
            ? <>{t("forms:data_series_input.unit_interpreted_as")} <strong>{t("common:tsx.unitless")}</strong></>
            : effectiveUnit.length === 0
              ? <>{t("forms:data_series_input.unit_interpreted_as")} <strong>{t("common:tsx.unit_missing")}</strong></>
              : parsedEffectiveUnit
                ? <>{t("forms:data_series_input.unit_interpreted_as")} <strong>{parsedEffectiveUnit}</strong></>
                : t("forms:data_series_input.unit_not_interpreted")
          }
        </small>

        {/* Unit text input */}
        <input
          type="text"
          className="block margin-top-25 width-100"
          disabled={inputDisabled}
          value={hasOverride ? expectedUnitInput : suggestedUnitInput}
          placeholder={suggestedUnitInput || t("common:tsx.unit_missing")}
          onChange={(event) => {
            const nextValue = event.target.value;
            setRecipeUnitAction(nextValue);
          }}
          style={{
            ...inputDisabled ? { backgroundColor: "var(--gray-95)" } : {},
          }}
        />
      </label>

      {allowOverrideSelection && unitsDiffer ? (
        <small className="block margin-top-25" style={{ overflowWrap: "anywhere" }}>
          {t("forms:data_series_input.unit_input.difference_notice", {
            expectedUnit: expectedDisplay,
            resolvedUnit: resolvedDisplay,
          })}
        </small>
      ) : null}


      {allowOverrideSelection ? (
        <label className="flex align-items-center gap-50 margin-top-25">
          <input
            type="checkbox"
            checked={hasOverride}
            onChange={(event) => {
              if (!event.target.checked) {
                setRecipeUnitAction(undefined);
                return;
              }

              const seededUnit = expectedUnit ?? resultingUnit;
              setRecipeUnitAction(seededUnit === undefined ? "" : seededUnit);
            }}
          />
          {t("forms:data_series_input.unit_input.override_toggle")}
        </label>
      ) : null}

      <small className="block margin-top-25 font-style-italic" style={{ overflowWrap: "anywhere" }}>
        {hasOverride
          ? t("forms:data_series_input.unit_override_status.overriding", {
            suggestedUnit: suggestedUnitInput.trim() || t("common:tsx.unit_missing"),
            overrideUnit: expectedDisplay,
          })
          : t("forms:data_series_input.unit_override_status.using", {
            suggestedUnit: suggestedUnitInput.trim() || t("common:tsx.unit_missing"),
          })
        }
      </small>
    </div>
  );
}
