import type { PxWebTimeVariable, PxWebVariable } from "@/lib/pxWeb/pxWebApiV2Types";
import type { TrafaVariable } from "@/lib/trafa/trafaTypes";
import type { TFunction } from "i18next";
import type { Dispatch, JSX, SetStateAction } from "react";
import type { ApiTableDetails } from "@/lib/api/apiTypes";
import type { ExternalSelection } from "./historical";
import { ExternalDataset } from "@/lib/api/utility";

export function timeVariableSelectionHelper({
  t,
  language,
  times,
  dataSource,
  optionalTag,
  tryGetResult,
  setStartPeriod,
}: {
  t: TFunction;
  language?: string;
  times: (TrafaVariable | PxWebTimeVariable)[];
  dataSource: string;
  optionalTag: (dataSource: string, variableIsOptional: boolean) => JSX.Element | undefined;
  tryGetResult: () => void;
  setStartPeriod: Dispatch<SetStateAction<string | undefined>>;
}) {
  if (
    (dataSource === "Trafa" && !(times.length === 1 && times[0].name === "ar")) ||
    (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && times.length > 1)
  ) {
    let heading = "";
    let defaultValue = "";
    let displayValueKey: keyof typeof times[0]/* "label" | "id" | "name" | "type" */ = "id";
    const variableIsOptional = times[0].optional;
    if (dataSource === "Trafa") {
      heading = t("components:query_builder.select_time_interval");
      defaultValue = t("components:query_builder.select_time_interval");
      displayValueKey = "label";
    } else if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") {
      heading = t("components:query_builder.select_starting_period");
      defaultValue = t("components:query_builder.select_time_period");
      displayValueKey = "id";
    }
    return (
      <label key="Tid">
        {heading}{optionalTag(dataSource, variableIsOptional)}
        <select className='block margin-top-25 margin-bottom-100 width-100 timeVariable'
          required={false}
          name="time"
          id="time"
          value={times?.length === 1 ? times[0].label : undefined}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            tryGetResult();
            setStartPeriod(e.target.value);
          }}
        >
          <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
          {times.map(time => (
            <option key={time.name} value={time.name} lang={language}>{time[displayValueKey]}</option>
          ))}
        </select>
      </label>
    );
  }
}

export function variableSelectionHelper({
  t,
  variable,
  tableDetails,
  historicalSelection,
  dataSource,
  optionalTag,
  tryGetResult,
}: {
  t: TFunction;
  variable: TrafaVariable | PxWebVariable;
  tableDetails: ApiTableDetails;
  historicalSelection: ExternalSelection;
  dataSource: string;
  optionalTag: (dataSource: string, variableIsOptional: boolean) => JSX.Element | undefined;
  tryGetResult: () => void;
}) {
  if (variable.option) {
    // The idea here is basically to we see which variables exist, and moving them to an array separately from metric as that value is already set. 
    // We then check if the variable which we render is in our list and get the default value from there.
    // This isnt very optimal as each render of a variable will trigger a loop of a new list, there is likely a better way to achieve this. 
    const variables = historicalSelection.filter((selectionVariable) => selectionVariable.variableCode !== "metric");

    const selectedVariable = variables.find(v => v.variableCode === variable.name);
    const selectedValue = selectedVariable ? selectedVariable.valueCodes[0] : '';

    return (
      <label key={variable.name}>
        {/* Only display "optional" tags if the data source provides this information */}
        {variable.label}{optionalTag(dataSource, variable.optional)}
        <select
          className='block margin-top-25 margin-bottom-100 width-100'
          required={!variable.optional}
          name={variable.name}
          id={variable.name}
          defaultValue={selectedValue}
          onChange={() => tryGetResult()}
        >
          { // If only one value is available, don't show a placeholder option
            (ExternalDataset.getDatasetByAlternateName(dataSource)?.api !== "PxWeb" ||
              (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && variable.values && variable.values.length > 1)) ? <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option> : null
          }
          {variable.values?.map(value => (
            <option key={`${variable.name}-${value.name}`} value={value.name} lang={tableDetails.language}>{value.label}</option>
          ))}
        </select>
      </label>
    );
  } else if (dataSource === "Trafa" && !variable.option && (variable as TrafaVariable).selected) {
    console.warn("The variable is selected while it is not an option. This should not happen.");
  }
}