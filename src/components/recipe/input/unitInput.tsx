"use client";

import mathjs, { allOurUnits } from "@/math";
import type { UnitString } from "@/types";
import { useCallback, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { IconCheck, IconInfoCircle } from "@tabler/icons-react";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";

/**
 * Text input for overriding the unit derived from a recipe context evaluation.
 *
 * The effective unit is:
 * 1) explicit override (if the input has been typed into), otherwise
 * 2) evaluated recipe unit, otherwise
 * 3) optional saved fallback unit.
 *
 * Typing into the input is itself what activates the override; clearing the
 * input back to empty reverts to the resolved unit.
 */
export function UnitInput({
  id,
  staticProvidedUnit,
  allowOverrideSelection = true,
}: {
  /** Applied to the override text input. Needed when several UnitInputs coexist (e.g. hidden form fieldsets). */
  id: string;
  staticProvidedUnit?: string | null;
  allowOverrideSelection?: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const { recipe, resultingUnit, applyRecipeUpdate } = useRecipe();

  const [overrideUnitInput, setOverrideUnitInput] = useState<string>(recipe.unit ?? "");

  const isOverriding = overrideUnitInput.trim() !== "";

  const resolvedUnit: string | null = resultingUnit ?? staticProvidedUnit ?? null;
  const resolvedDisplay = resolvedUnit === null
    ? t("common:tsx.unitless")
    : resolvedUnit.trim() || t("common:tsx.unit_missing");

  const effectiveUnit: string | null = isOverriding ? overrideUnitInput : resolvedUnit;

  // Normalized mathjs interpretation of the effective unit; null when it cannot be parsed.
  const parsedEffectiveUnit = useMemo(() => {
    if (typeof effectiveUnit !== "string" || effectiveUnit.trim() === "") return null;
    try {
      return mathjs.unit(effectiveUnit.trim()).toString();
    } catch {
      return null;
    }
  }, [effectiveUnit]);

  const noInitialUnit: boolean = (effectiveUnit === null || effectiveUnit.trim() === "");
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

  const handleOverrideInputChange = useCallback((value: string) => {
    setOverrideUnitInput(value);
    // An empty input means "no override" — clear it on the recipe rather than
    // storing an empty-string unit.
    setRecipeUnit(value.trim() === "" ? undefined : value);
  }, [setRecipeUnit]);

  return (
    <>
      {/* Type to override unit */}
      {!!allowOverrideSelection &&
        <>
          <label className="block margin-top-100" htmlFor={id}>
            {t("forms:data_series_input.unit_input.unit")}
          </label>

          <TextSingleAutocomplete
            props={{
              id: id,
              name: id,
              className: "margin-top-25",
              placeholder: resolvedDisplay,
            }}
            options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
            value={overrideUnitInput}
            setter={setOverrideUnitInput}
            onChange={(value) => { handleOverrideInputChange(value); }}
          />
        </>
      }

      {interpretedDisplay !== null ?
        <small className="flex align-items-center gap-25 margin-top-25 margin-bottom-0" style={{ color: "green" }}>
          <IconCheck width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
          <Trans
            i18nKey="forms:data_series_input.unit_interpreted_as"
            values={{ unit: interpretedDisplay }}
            components={{ a: <strong /> }}
          />
        </small>
        :
        <small className="flex align-items-center gap-25 margin-top-25 margin-bottom-0" style={{ color: "#dfab00" }}>
          <IconInfoCircle width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
          {t("forms:data_series_input.unit_not_interpreted")}
        </small>
      }
      <small className="flex align-items-center gap-25 margin-top-25 margin-bottom-0" style={{ color: "#dfab00" }}>
        {isOverriding && noInitialUnit ? // No need to let the user know that they are overriding "unitless", as this is not a unit
          <>
            <IconInfoCircle width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
            <Trans
              i18nKey={"forms:data_series_input.unit_override_status.overriding"}
              values={{
                resolvedUnit: resolvedDisplay,
                overrideUnit: overrideUnitInput.trim() || t("common:tsx.unit_missing"),
              }}
              components={{ a: <strong /> }}
            />
          </>
          : null}
      </small>
    </>
  );
}