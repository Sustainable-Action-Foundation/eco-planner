import React, { useMemo } from "react";
import { useRecipe } from "../../context/recipeContext.use";
import { DateValuesWithUnit } from "@/types";

/** 
 * ## What is this?
 * 
 * Well, to have a form get any information out of the Recipe Context Provider, 
 * this component is used inside of the provider to be able to inject 
 * hidden form elements with the relevant data.
 */
export default function FormIntegration({
  DataSeriesFormElement,
  UnitFormElement,
  RecipeFormElement,
  DateValuesFormElement,
}: {
  DataSeriesFormElement?: React.ReactElement<HTMLInputElement>;
  UnitFormElement?: React.ReactElement<HTMLInputElement>;
  RecipeFormElement?: React.ReactElement<HTMLInputElement>;
  DateValuesFormElement?: React.ReactElement<HTMLInputElement>;
}) {
  const {
    recipe,
    resultingDataSeries,
    resultingUnit,
  } = useRecipe();

  const dateValues: DateValuesWithUnit | undefined = useMemo(() => {
    if (!resultingDataSeries) return undefined;
    return { unit: resultingUnit, dateValues: resultingDataSeries };
  }, [resultingDataSeries, resultingUnit]);

  return (<>
    {DataSeriesFormElement && React.cloneElement(DataSeriesFormElement, {
      defaultValue: JSON.stringify(resultingDataSeries),
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {UnitFormElement && React.cloneElement(UnitFormElement, {
      defaultValue: resultingUnit ?? "",
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {RecipeFormElement && React.cloneElement(RecipeFormElement, {
      defaultValue: JSON.stringify(recipe),
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
    {DateValuesFormElement && React.cloneElement(DateValuesFormElement, {
      defaultValue: JSON.stringify(dateValues),
      type: "hidden",
      hidden: true,
      readOnly: true,
    })}
  </>);
}