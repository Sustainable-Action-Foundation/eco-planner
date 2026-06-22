"use client";

import type { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { ExternalDataset } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { PxWebTimeVariable, PxWebVariable } from "@/lib/pxWeb/pxWebApiV2Types";
import type { TrafaVariable } from "@/lib/trafa/trafaTypes";
import type { Goal } from "@/types";
import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import type { SubmitEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import DataSeriesInputManual from "../elements/dataSeriesInput/dataSeriesInputManual";

type ExternalSelection = NonNullable<Parameters<typeof getTableDetails>[2]>;

const HistoricalDataType = {
  Initial: "INITIAL",
  Custom: "CUSTOM",
} as const;
type HistoricalDataType = (typeof HistoricalDataType)[keyof typeof HistoricalDataType];

export default function HistoricalDataSection({
  goal,
}: {
  goal?: Goal
}) {

  const { t } = useTranslation("components");
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;

  // The external API selection is stored in the goal's historical recipe; the
  // fetched values live in the `historical` DataSeries.
  const historicalSource = goal ? getHistoricalSource(goal) : null;
  const historicalSelection: ExternalSelection = historicalSource?.selection ?? [];

  // const [isLoading, setIsLoading] = useState(false);
  // const [visibleForm, setVisibleForm] = useState('manual')

  const [dataSource, setDataSource] = useState<string>(historicalSource?.dataset ?? "");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [table, setTable] = useState<{ tableId: string, label: string } | null>(historicalSource?.tableId ? { label: tables?.find(t => t.tableId === historicalSource.tableId)?.label ?? historicalSource.tableId, tableId: historicalSource.tableId } : null);
  const [metric, setMetric] = useState<string | null>(() => historicalSelection[0]?.valueCodes?.[0] ?? null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [startPeriod, setStartPeriod] = useState<string | undefined>(undefined);
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(HistoricalDataType.Initial); // Default to initial right now but solve this the same way we solve baseline at a late point

  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  // const deleteDataRef = useRef<HTMLDialogElement>(null)

  // Gets relevant info from variable inputs
  const buildQuery = useCallback((formData: FormData) => {
    const queryObject: ExternalSelection = [];
    formData.forEach((value, key) => {
      // Skip empty values
      // Skip File inputs
      // Skip externalDataset and externalTableId, they are not part of the query
      if (!value) return;
      if (value instanceof File) return;
      if (key === "externalDataset") return;
      if (key === "externalTableId") return;

      // The PxWeb time variable is special, as we want to fetch every period after (and including) the selected one
      if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && key === formRef.current?.getElementsByClassName("TimeVariable")[0]?.id) {
        queryObject.push({ variableCode: key, valueCodes: [`FROM(${value})`] });
        return;
      }
      queryObject.push({ variableCode: key, valueCodes: [value] });
    });
    return queryObject;
  }, [dataSource]);

  const tryGetResult = useCallback((event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    // setIsLoading(true);

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData);

      getTableContent(table ? table.tableId : "", dataSource, query, lang).then(result => {
        setTableContent(result);
        // setIsLoading(false);
      }).catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table content:", errorMessage);
        setTableContent(null);
        // setIsLoading(false);
      });

      if (dataSource === "Trafa") {
        // If metric was changed, send the metric as a query to the API to get filtered table details
        if (event?.target instanceof HTMLSelectElement && event.target.name === "metric") {
          void getTableDetails(table ? table.tableId : "", dataSource, query.filter(q => q.variableCode === "metric"), lang).then(result => { setTableDetails(result); });
        }
      }

    } else {
      setTableContent(null);
      // setIsLoading(false);
    }
  }, [buildQuery, table, dataSource, lang]);


  // 1. Fetch table details
  const initialTableId = historicalSource?.tableId ?? null;
  const initialDataset = historicalSource?.dataset ?? null;
  useEffect(() => {
    if (!initialTableId || !initialDataset) return;

    void getTableDetails(
      initialTableId,
      initialDataset,
      historicalSelection,
      lang,
    ).then(setTableDetails);
    // historicalSelection is derived from the same recipe as initialTableId/initialDataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTableId, initialDataset, lang]);

  // 2. Fetch table content
  useEffect(() => {
    if (!formRef.current || !tableDetails) return;
    tryGetResult();
  }, [tableDetails, tryGetResult]);

  useEffect(() => {
    if (!dataSource) return;
    // setIsLoading(true);

    // TODO: Undefined here is query, we likely want to remove it once this is all set ut and queryBuilder.tsx is removed
    void getTables(dataSource, undefined, lang).then(result => {
      setTables(result);
      // setIsLoading(false);
    });
  }, [dataSource, lang]);

  {/* TODO: See if we can remove table content when de-selecting  */ }
  const handleTableSelect = useCallback((tableId: string | null) => {
    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;
    if (!tableId) return;
    // setIsLoading(true);

    setTableContent(null);
    setTableDetails(null);

    void getTableDetails(tableId, dataSource, undefined, lang).then(result => {
      setTableDetails(result);
      // setIsLoading(false);
    });
  }, [dataSource, lang]);

  useEffect(() => {
    handleTableSelect(!!table?.tableId ? table.tableId : null);
  }, [table, handleTableSelect]);

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean) {
    if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && variableIsOptional) return <span className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</span>;
  }

  function variableSelectionHelper(variable: TrafaVariable | PxWebVariable, tableDetails: ApiTableDetails) {
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
          {
          /* TODO: Use CSS to set proper capitalization of labels; something like `label::first-letter { text-transform: capitalize; }` */}
          <select
            className='block margin-top-25 margin-bottom-100'
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

  // TODO: this does not change table content values. Should it ?
  function timeVariableSelectionHelper(times: (TrafaVariable | PxWebTimeVariable)[], language?: string) {
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
          <select className='block margin-top-25 margin-bottom-100 TimeVariable'
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


  function shouldVariableFieldsetBeVisible(tableDetails: ApiTableDetails, dataSource: string) {
    const returnBool = ((tableDetails.hierarchies && tableDetails.hierarchies.length > 0) || (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableDetails.variables.some(variable => variable.option)) || tableDetails.times.length > 1);
    return returnBool;
  }

  return (

    <div>
      {/* Hidden disabled submit button to prevent accidental submission */}
      <button type="submit" className="display-none" disabled={true}></button>
      
      <label>
        {t("forms:goal.baseline_label")}
        <select className="block margin-top-25 margin-bottom-100" name="baselineSelector" id="baselineSelector" value={historicalDataType} onChange={(e) => setHistoricalDataType(e.target.value as HistoricalDataType)}>
          <option value={HistoricalDataType.Initial}>{t("forms:goal.historical_data.external")}</option>
          <option value={HistoricalDataType.Custom}>{t("forms:goal.historical_data.custom")}</option>
        </select>
      </label>

      {historicalDataType === HistoricalDataType.Initial ? (
        <>
          <fieldset
            className="width-100 min-width-0"
          >
            <legend className="padding-block-125 font-weight-bold">
              {t("components:query_builder.data_source")}
            </legend>
            <label className="margin-block-75 font-weight-500">
              {t("components:query_builder.data_source")}
              {/* Display warning message if the selected language is not supported by the api */}
              {((ExternalDataset.getDatasetByAlternateName(dataSource)) && !(ExternalDataset.getDatasetByAlternateName(dataSource)?.supportedLanguages.includes(lang))) ?
                <small className="font-weight-normal font-style-italic margin-left-50" style={{ color: "red" }}>{t("components:query_builder.language_support_warning", { dataSource: dataSource })}</small>
                : null}
              <select
                defaultValue={historicalSource?.dataset ?? ''}
                className="block margin-top-25 margin-bottom-100 width-100"
                required={true}
                name="externalDataset"
                id="externalDataset"
                onChange={e => {
                  setDataSource(e.target.value);
                  setTable(null);
                  setMetric(null);
                  setTableContent(null);
                  setTableDetails(null);
                }}>
                <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_source")}</option>
                {ExternalDataset.knownDatasetKeys.map((name) => (
                  <option key={name} value={name}>{ExternalDataset[name]?.fullName}</option>
                ))}
              </select>
            </label>
            <label htmlFor="externalTableId">{t("components:query_builder.table")}</label>
            <SelectSingleSearch
              props={{
                className: 'margin-top-25 margin-bottom-100',
                id: 'externalTableId',
                name: 'externalTableId',
                placeholder: !dataSource ? t("components:query_builder.select_source_for_table") : t("components:query_builder.select_table"),
                required: true,
                disabled: !dataSource ? true : false,
              }}
              defaultValue={table ? { name: table.label, value: table.tableId } : false}
              options={
                tables
                  ? tables.map(({ tableId, label }) => ({
                    name: label,
                    value: tableId,
                  }))
                  : []
              }
              onChange={(value) => value?.value ? setTable({ tableId: value.value, label: value.name }) : setTable(null)}
            />
          </fieldset>

          <fieldset
            className="width-100 margin-top-200 min-width-0">
            <legend className="padding-block-125 font-weight-bold"
            >
              {t("components:query_builder.select_metric_for_table")}
            </legend>
            {table && tableDetails ? (
              <label key={`metric-${tableDetails.id}`}>
                {t("components:query_builder.select_metric")}
                <select className={`block margin-top-25 margin-bottom-100 metric`}
                  required={true}
                  name="metric"
                  id="metric"
                  value={!!metric ? metric : ''}
                  onChange={(e) => { setMetric(e.target.value); setTimeout(() => tryGetResult(e), 0); }}
                >
                  <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_metric")}</option>
                  {tableDetails.metrics?.map(metric => (
                    <option key={metric.name} value={metric.name} lang={tableDetails.language}>{metric.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="margin-0 margin-bottom-100">
                {t("components:query_builder.select_source_for_metric")}
              </p>
            )}
          </fieldset>

          <fieldset
            name="variableSelectionFieldset"
            className="width-100 margin-top-200 min-width-0"
          >
            <legend className="padding-block-125 font-weight-bold" >
              {t("components:query_builder.select_values_for_table")}
            </legend>

            {tableDetails && metric ? (
              shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? (
                <div>
                  {tableDetails.times
                    ? timeVariableSelectionHelper(tableDetails.times, tableDetails.language)
                    : null}

                  {tableDetails.variables.map(variable =>
                    variableSelectionHelper(variable, tableDetails),
                  )}

                  {tableDetails.hierarchies?.map(hierarchy => {
                    if (!hierarchy.children?.some(variable => variable.option)) return null;
                    return (
                      <div key={hierarchy.name}>
                        <div className="font-weight-bold">{hierarchy.label}</div>
                        <div className="block margin-block-75 margin-left-75">
                          {hierarchy.children?.map(variable =>
                            variableSelectionHelper(variable, tableDetails),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="font-style-italic color-gray margin-0 margin-bottom-100">
                  {t("components:query_builder.no_variables_found")}
                </p>
              )
            ) : (
              <p className="margin-0 margin-bottom-100">
                {t("components:query_builder.select_metric_for_values")}
              </p>
            )}
          </fieldset>
        </>
      ) :
        <DataSeriesInputManual 
          id="historical-data-series"
          label={t("forms:data_series_input.data_series")}
          outputFormElement={ <input name="historical-data-series" /> }
        />
      }
    </div>
  );
};