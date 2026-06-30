"use client";

import type { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { ExternalDataset } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { Goal } from "@/types";
import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import type { SubmitEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "../../elements/combobox/selectSingleSearch";
import DataSeriesInputManual from "../../elements/dataSeriesInput/dataSeriesInputManual";
import { timeVariableSelectionHelper, variableSelectionHelper } from "./helpers";

export type ExternalSelection = NonNullable<Parameters<typeof getTableDetails>[2]>;

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
  const [dataSource, setDataSource] = useState<string>(historicalSource?.dataset ?? "");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [table, setTable] = useState<{ tableId: string, label: string } | null>(historicalSource?.tableId ? { label: tables?.find(t => t.tableId === historicalSource.tableId)?.label ?? historicalSource.tableId, tableId: historicalSource.tableId } : null);
  const [metric, setMetric] = useState<string | null>(() => historicalSelection[0]?.valueCodes?.[0] ?? null);
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(HistoricalDataType.Initial); // Default to initial right now but solve this the same way we solve baseline at a late point
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [startPeriod, setStartPeriod] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const sectionRef = useRef<HTMLDivElement | null>(null);

  const buildQuery = useCallback((): ExternalSelection => {
    const queryObject: ExternalSelection = [];
    const elements = sectionRef.current?.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input");
    elements?.forEach((el) => {
      if (!el.value || el.name === "externalDataset" || el.name === "externalTableId") return;

      if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && el.name === "time") {
        queryObject.push({ variableCode: el.name, valueCodes: [`FROM(${el.value})`] });
        return;
      }
      queryObject.push({ variableCode: el.name, valueCodes: [el.value] });
    });
    return queryObject;
  }, [dataSource]);

  const tryGetResult = useCallback((event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => {
    if (!sectionRef.current) return;

    const elements = sectionRef.current.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input");
    const isValid = Array.from(elements).every(el => el.checkValidity());
    if (isValid) {
      const query = buildQuery();

      getTableContent(table ? table.tableId : "", dataSource, query, lang).then(result => {
        setTableContent(result);
      }).catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table content:", errorMessage);
        setTableContent(null);
      });

      if (dataSource === "Trafa") {
        if (event?.target instanceof HTMLSelectElement && event.target.name === "metric") {
          void getTableDetails(table ? table.tableId : "", dataSource, query.filter(q => q.variableCode === "metric"), lang).then(result => { setTableDetails(result); });
        }
      }
    } else {
      setTableContent(null);
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
    if (!sectionRef.current || !tableDetails) return;
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

  function shouldVariableFieldsetBeVisible(tableDetails: ApiTableDetails, dataSource: string) {
    const returnBool = ((tableDetails.hierarchies && tableDetails.hierarchies.length > 0) || (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableDetails.variables.some(variable => variable.option)) || tableDetails.times.length > 1);
    return returnBool;
  } 

  return (
    <div ref={sectionRef}>
      <label>
        {t("forms:goal.historical_label")}
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
                <select className={`block margin-top-25 margin-bottom-100 width-100`}
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
                    ? timeVariableSelectionHelper({
                      t,
                      language: tableDetails.language,
                      times: tableDetails.times,
                      dataSource,
                      optionalTag,
                      tryGetResult,
                      setStartPeriod,
                    })
                    : null}

                  {tableDetails.variables.map(variable =>
                    variableSelectionHelper({
                      t,
                      variable,
                      tableDetails,
                      historicalSelection,
                      dataSource,
                      optionalTag,
                      tryGetResult,
                    }),
                  )}

                  {tableDetails.hierarchies?.map(hierarchy => {
                    if (!hierarchy.children?.some(variable => variable.option)) return null;
                    return (
                      <div key={hierarchy.name}>
                        <div className="font-weight-bold">{hierarchy.label}</div>
                        <div className="block margin-block-75 margin-left-75">
                          {hierarchy.children?.map(variable =>
                            variableSelectionHelper({
                              t,
                              variable,
                              tableDetails,
                              historicalSelection,
                              dataSource,
                              optionalTag,
                              tryGetResult,
                            }),
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
          outputFormElement={<input name="historical-data-series" />}
        />
      }
    </div>
  );
};