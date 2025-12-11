import React from "react";
import { useRecipe } from "../../contextProvider";

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
}: {
  DataSeriesFormElement?: React.ReactElement<HTMLFormElement>;
  UnitFormElement?: React.ReactElement<HTMLFormElement>;
  RecipeFormElement?: React.ReactElement<HTMLFormElement>;
}) {
  const {
    recipe,
    resultingDataSeries,
    resultingUnit
  } = useRecipe();

  return (<>
    {DataSeriesFormElement && React.cloneElement(DataSeriesFormElement, {
      defaultValue: JSON.stringify(resultingDataSeries),
      hidden: true,
    })}
    {UnitFormElement && React.cloneElement(UnitFormElement, {
      defaultValue: resultingUnit || "",
      hidden: true,
    })}
    {RecipeFormElement && React.cloneElement(RecipeFormElement, {
      defaultValue: JSON.stringify(recipe),
      hidden: true,
    })}
  </>);
}