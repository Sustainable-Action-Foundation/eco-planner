import type { TFunction } from "i18next";
import type { JSX, SubmitEvent } from "react";
import { ExternalDataset } from "@/lib/api/utility";
import type { ApiMetadataDimensionBase, ApiSelectionItem, ApiTableMetadata, DatasetData } from "@/lib/api/apiTypes";
import type { ExternalData, ExternalDataAction } from "@/components/types";

// TODO: Look over naming now that this is in the /api folder
// TODO: Actually should probably not be in the api folders

/**
 * `form` attribute for the external-data selection controls. It matches no
 * `<form>` id, so the controls get no form owner: they must not join a
 * surrounding form's native validation (a required, empty select would
 * silently veto submission) or its FormData. Selection completeness is
 * instead checked per element via `checkValidity()` in `buildQuery()`.
 */
export const EXTERNAL_SELECTION_DETACHED_FORM = "external-selection-has-no-form-owner";

export function metricSelectionHelper({
  t,
  metricDimension,
  tableMetadata,
  dataSource,
  historicalSelection,
  tryGetResult,
  getInitialSelectionValue,
}: {
  t: TFunction;
  metricDimension: ApiMetadataDimensionBase;
  tableMetadata: ApiTableMetadata;
  dataSource: string;
  historicalSelection: ApiSelectionItem[];
  tryGetResult: (event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => void;
  getInitialSelectionValue: (variableCode: string, historicalSelection: ApiSelectionItem[]) => string | undefined;
}) {
  if (metricDimension.options) {
    return (
      <label key={`metric-${tableMetadata.tableId}-${metricDimension.id}`}>
        {metricDimension.label || metricDimension.name}
        <select className="block margin-top-25 margin-bottom-100 width-100 metric"
          form={EXTERNAL_SELECTION_DETACHED_FORM}
          required={true}
          name={metricDimension.id}
          id={metricDimension.id}
          defaultValue={getInitialSelectionValue(metricDimension.id, historicalSelection) ?? (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && metricDimension.options.length === 1 ? metricDimension.options[0].value : undefined)}
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
  datasetInfo,
  historicalSelection,
  optionalTag,
  tryGetResult,
  getInitialSelectionValue,
}: {
  t: TFunction;
  language?: string;
  time: ApiMetadataDimensionBase;
  dataSource: string;
  datasetInfo: DatasetData | null;
  historicalSelection: ApiSelectionItem[];
  optionalTag: (t: TFunction, variableIsOptional: boolean | null | undefined, datasetInfo: DatasetData | null) => JSX.Element | undefined;
  tryGetResult: (event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => void;
  getInitialSelectionValue: (variableCode: string, historicalSelection: ApiSelectionItem[]) => string | undefined;
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
      {heading}{optionalTag(t, time.optional ?? false, datasetInfo)}
      <select className='block margin-top-25 margin-bottom-100 width-100 timeVariable'
        form={EXTERNAL_SELECTION_DETACHED_FORM}
        required={!time.optional}
        name={time.id}
        id={time.id}
        defaultValue={getInitialSelectionValue(time.id, historicalSelection) ?? (time.options.length === 1 ? time.options[0].value : "")}
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
  datasetInfo,
  optionalTag,
  tryGetResult,
}: {
  t: TFunction;
  dimension: ApiMetadataDimensionBase;
  tableMetadata: ApiTableMetadata;
  historicalSelection: ApiSelectionItem[];
  dataSource: string;
  datasetInfo: DatasetData | null;
  optionalTag: (t: TFunction, variableIsOptional: boolean | null | undefined, datasetInfo: DatasetData | null) => JSX.Element | undefined;
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
        {dimension.label || dimension.name}{optionalTag(t, dimension.optional, datasetInfo)} {/* TODO: Maybe this should be implement in the same way as the options in the select? */}
        <select
          className='block margin-top-25 margin-bottom-100 width-100'
          form={EXTERNAL_SELECTION_DETACHED_FORM}
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

export function optionalTag(
  t: TFunction,
  variableIsOptional: boolean | null | undefined,
  datasetInfo: DatasetData | null,
): JSX.Element | undefined {
  if (datasetInfo?.api === "PxWeb" && variableIsOptional) {
    return <span className="font-style-italic color-gray"> - ({t("components:query_builder.optional")}) </span>;
  }
}

export function shouldVariableFieldsetBeVisible(tableMetadata: ApiTableMetadata, datasetInfo: DatasetData | null) {
  // Show if there are hierarchies
  if (tableMetadata.hierarchies && tableMetadata.hierarchies.length > 0) return true;
  // Show if there is a selection to be made for any regular dimension
  if (tableMetadata.regularDimensions.some(variable => variable.options.length > 1)) return true;
  // If the data source is not PxWeb, we do not set default value on selects with only one option (why?), so we show the fieldset if any regular dimension has options
  if (!(datasetInfo?.api === "PxWeb") && tableMetadata.regularDimensions.some(variable => variable.options.length > 0)) return true;
  // Show if any time dimension has more than one option
  if (tableMetadata.timeDimensions.some(time => time.options.length > 1)) return true;
  return false;
}

export function getInitialSelectionValue(variableCode: string, historicalSelection: ApiSelectionItem[]) {
  const valueCode = historicalSelection.find(selection => selection.variableCode === variableCode)?.valueCodes?.[0];
  if (!valueCode) return undefined;

  const fromMatch = /^FROM\((.+)\)$/i.exec(valueCode);
  return fromMatch?.[1] ?? valueCode;
}

export function externalDataReducer(state: ExternalData, action: ExternalDataAction): ExternalData {
  switch (action.type) {
    case "SELECT_DATASET": {
      // Changing data source invalidates everything downstream.
      return {
        dataSource: action.dataSource,
        table: null,
        tables: null,
        tableMetadata: null,
        tableContent: null,
        selection: null,
        mainTimeDimensionId: null,
      };
    }

    case "SELECT_TABLE": {
      // Changing table invalidates metadata/content, but keeps dataSource.
      return {
        ...state,
        table: action.table,
        tableMetadata: null,
        tableContent: null,
        selection: null,
        mainTimeDimensionId: null,
      };
    }

    case "SET_TABLES": {
      // The freshly fetched list may contain a nicer label for the currently-selected table
      const currentTable = state.table;
      const match = currentTable
        ? action.tables?.find(t => t.tableId === currentTable.tableId)
        : undefined;

      const table =
        currentTable && match && match.label !== currentTable.label
          ? { ...currentTable, label: match.label }
          : state.table;

      return { ...state, tables: action.tables, table };
    }


    case "UPDATE_TABLE_LABEL": {
      // Only fires when the `tables` list resolves a nicer label for the
      // already-selected table; doesn't touch anything else.
      return state.table
        ? { ...state, table: { ...state.table, label: action.label } }
        : state;
    }

    case "SET_METADATA": {
      if (!action.metadata) {
        return { ...state, tableMetadata: null, mainTimeDimensionId: null };
      }

      // Recompute mainTimeDimensionId When the table or its time dimensions change
      const isSameTableShape =
        state.tableMetadata?.tableId === action.metadata.tableId
        && state.tableMetadata?.timeDimensions === action.metadata.timeDimensions;

      if (isSameTableShape) {
        return { ...state, tableMetadata: action.metadata };
      }

      const mainTimeDimensionId =
        action.metadata.timeDimensions.length === 1
          ? action.metadata.timeDimensions[0].id
          : null;

      return {
        ...state,
        tableMetadata: action.metadata,
        mainTimeDimensionId,
      };
    }

    case "SET_CONTENT": {
      return {
        ...state,
        tableContent: action.content,
        selection: action.selection,
      };
    }

    default: {
      return state;
    }
  }
}