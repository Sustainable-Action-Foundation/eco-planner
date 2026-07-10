import type { TFunction } from "i18next";
import type { JSX, SubmitEvent } from "react";
import type { ExternalSelection } from "../sections/historical/section";
import { ExternalDataset } from "@/lib/api/utility";
import type { ApiMetadataDimensionBase, ApiTableMetadata } from "@/lib/api/apiTypes";

// TODO: Look over naming now that this is in the /api folder

export function metricSelectionHelper({
  t,
  metricDimension,
  tableMetadata,
  dataSource,
  tryGetResult,
  getInitialSelectionValue,
}: {
  t: TFunction;
  metricDimension: ApiMetadataDimensionBase;
  tableMetadata: ApiTableMetadata;
  dataSource: string;
  tryGetResult: (event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => void;
  getInitialSelectionValue: (variableCode: string) => string | undefined;
}) {
  if (metricDimension.options) {
    return (
      <label key={`metric-${tableMetadata.tableId}-${metricDimension.id}`}>
        {metricDimension.label || metricDimension.name}
        <select className="block margin-top-25 margin-bottom-100 width-100 metric"
          required={true}
          name={metricDimension.id}
          id={metricDimension.id}
          defaultValue={getInitialSelectionValue(metricDimension.id) ?? (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && metricDimension.options.length === 1 ? metricDimension.options[0].value : undefined)}
          onChange={(e) => tryGetResult(e)}
        >
          {((ExternalDataset.getDatasetByAlternateName(dataSource)?.api !== "PxWeb") || metricDimension.options.length > 1)
            ? <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_metric")}</option>
            : null}
          {metricDimension.options.map(({ label, value }) => (
            <option key={`${metricDimension.id}-${value}`} value={value} lang={tableMetadata.language}>{label || value}</option>
          ))}
        </select>
      </label>
    );
  }
}

export function timeVariableSelectionHelper({
  t,
  language,
  time,
  dataSource,
  optionalTag,
  tryGetResult,
  getInitialSelectionValue,
}: {
  t: TFunction;
  language?: string;
  time: ApiMetadataDimensionBase;
  dataSource: string;
  optionalTag: (dataSource: string, variableIsOptional: boolean) => JSX.Element | undefined;
  tryGetResult: (event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => void;
  getInitialSelectionValue: (variableCode: string) => string | undefined;
}) {

  let heading = "";
  let defaultValue = "";
  if (dataSource === "Trafa") {
    heading = t("components:query_builder.select_time_interval");
    defaultValue = t("components:query_builder.select_time_interval");
  } else if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") {
    heading = t("components:query_builder.select_starting_period");
    defaultValue = t("components:query_builder.select_time_period");
  }

  return (
    <label key={`${time.id}`}>
      {heading}{optionalTag(dataSource, time.optional ?? false)}
      <select className='block margin-top-25 margin-bottom-100 width-100 timeVariable'
        required={!time.optional}
        name={time.id}
        id={time.id}
        defaultValue={getInitialSelectionValue(time.id) ?? (time.options.length === 1 ? time.options[0].value : "")}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          tryGetResult(e);
        }}
      >
        <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
        {time.options.map(({ value, label }) => (
          <option key={`${time.id}-${label || value}`} value={value} lang={language}>{label || value}</option>
        ))}
      </select>
    </label>
  );
}


export function variableSelectionHelper({
  t,
  dimension,
  tableMetadata,
  historicalSelection,
  dataSource,
  optionalTag,
  tryGetResult,
}: {
  t: TFunction;
  dimension: ApiMetadataDimensionBase;
  tableMetadata: ApiTableMetadata;
  historicalSelection: ExternalSelection;
  dataSource: string;
  optionalTag: (dataSource: string, variableIsOptional: boolean | null | undefined) => JSX.Element | undefined;
  tryGetResult: (event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => void;
}) {
  if (dimension.options) {
    // The idea here is basically to we see which variables exist, and moving them to an array separately from metric as that value is already set. 
    // We then check if the variable which we render is in our list and get the default value from there.
    // This isnt very optimal as each render of a variable will trigger a loop of a new list, there is likely a better way to achieve this. 
    const metricVariableCodes = tableMetadata.metricDimensions.map(metricDimension => metricDimension.id);
    const variables = historicalSelection.filter((selectionVariable) => !metricVariableCodes.includes(selectionVariable.variableCode));

    const selectedVariable = variables.find(v => v.variableCode === dimension.id);
    const selectedValue = selectedVariable ? selectedVariable.valueCodes[0] : '';

    return (
      <label key={dimension.id}>
        {/* Only display "optional" tags if the data source provides this information */}
        {dimension.label || dimension.name}{optionalTag(dataSource, dimension.optional)}
        <select
          className='block margin-top-25 margin-bottom-100 width-100'
          required={!dimension.optional}
          name={dimension.id}
          id={dimension.id}
          defaultValue={selectedValue}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => tryGetResult(e)}
        >
          { // If only one value is available, don't show a placeholder option
            (ExternalDataset.getDatasetByAlternateName(dataSource)?.api !== "PxWeb" ||
              (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && dimension.options.length > 1)) ? <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option> : null
          }
          {dimension.options?.map(({ label, value }) => (
            <option key={`${dimension.id}-${value}`} value={value} lang={tableMetadata.language}>{label || value}</option>
          ))}
        </select>
      </label>
    );
  }
}