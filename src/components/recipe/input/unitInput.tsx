"use client";

import mathjs, { allOurUnits } from "@/math";
import type { Unit } from "@/types";
import { UnitFlags } from "@/types/enums";
import { isUnitFlag, parseUnit } from "@/functions/unit";
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
  staticProvidedUnit?: Unit;
  allowOverrideSelection?: boolean;
}) {
  const { t } = useTranslation(["forms", "common"]);
  const { recipe, resultingUnit, applyRecipeUpdate } = useRecipe();

  // The input's raw text; unit flags render as an empty input.
  const [overrideUnitInput, setOverrideUnitInput] = useState<string>(isUnitFlag(recipe.unit) ? "" : recipe.unit);

  const isOverriding = overrideUnitInput.trim() !== "";

  const resolvedUnit: Unit = resultingUnit === UnitFlags.Missing
    ? (staticProvidedUnit ?? UnitFlags.Missing)
    : resultingUnit;
  const resolvedDisplay = resolvedUnit === UnitFlags.Unitless
    ? t("common:tsx.unitless")
    : resolvedUnit === UnitFlags.Missing
      ? t("common:tsx.unit_missing")
      : resolvedUnit;

  const effectiveUnit: Unit = isOverriding ? parseUnit(overrideUnitInput) : resolvedUnit;

  // Normalized mathjs interpretation of the effective unit; null when it cannot be parsed.
  const parsedEffectiveUnit = useMemo(() => {
    if (isUnitFlag(effectiveUnit)) return null;
    try {
      return mathjs.unit(effectiveUnit.trim()).toString();
    } catch {
      return null;
    }
  }, [effectiveUnit]);

  // Only mention the override when it actually masks a different, real resolved
  // unit: overriding "unitless"/"missing" needs no notice, and once the declared
  // unit has been folded into the evaluation result the two are equal anyway.
  const overrideMasksResolvedUnit = isOverriding
    && !isUnitFlag(resolvedUnit)
    && resolvedUnit.trim() !== overrideUnitInput.trim();
  const interpretedDisplay = effectiveUnit === UnitFlags.Unitless
    ? t("common:tsx.unitless")
    : effectiveUnit === UnitFlags.Missing
      ? t("common:tsx.unit_missing")
      : parsedEffectiveUnit;

  const setRecipeUnit = useCallback((nextUnit: Unit) => {
    void applyRecipeUpdate((current) => {
      const normalizedNextUnit: Unit = isUnitFlag(nextUnit)
        ? nextUnit
        : parseUnit(nextUnit.trim());

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
    // An empty input parses to "missing", i.e. "no override" — the declared
    // unit is cleared rather than stored as an empty string.
    setRecipeUnit(parseUnit(value));
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
      {overrideMasksResolvedUnit ?
        <small className="flex align-items-center gap-25 margin-top-25 margin-bottom-0" style={{ color: "#dfab00" }}>
          <IconInfoCircle width={20} height={20} style={{ minWidth: '20px' }} aria-hidden="true" />
          <Trans
            i18nKey={"forms:data_series_input.unit_override_status.overriding"}
            values={{
              resolvedUnit: resolvedDisplay,
              overrideUnit: overrideUnitInput.trim() || t("common:tsx.unit_missing"),
            }}
            components={{ a: <strong /> }}
          />
        </small>
        : null}
    </>
  );
}