"use client";

import formSubmitter from "@/functions/formSubmitter";
import type { ApiTableContent, ApiTableMetadata } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { ExternalDataset, formQueryHelper, isDataSetKeys } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import { GoalDataTarget } from "@/types";
import type { DateValues, Goal, GoalUpdateInput } from "@/types";
import { Recipe } from "@/functions/recipe";
import { getHistoricalDataset, getHistoricalSource } from "@/functions/getHistoricalDataset";
import type { SubmitEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import TabList from "@/components/generic/tablist/tabList";
import GoalGraph from "@/components/graph/graphs/goal/main";
import { calculatePredictedOutcome } from "@/components/graph/functions/graphFunctions";
import { metricSelectionHelper, timeVariableSelectionHelper, variableSelectionHelper } from "../api/helpers";


type ExternalSelection = NonNullable<Parameters<typeof getTableMetadata>[2]>;

// TODO: Stuff is re-rendering like a bajillion times, fix this.
// TODO: Editing data shows table code not name when autofilling

{/* TODO: Metadata */ }
export default function HistoricalData({
  goal,
}: {
  goal: Goal
}) {

  const { t } = useTranslation("components");
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;

  // The external API selection is stored in the goal's historical recipe; the
  // fetched values live in the `historical` DataSeries.
  const historicalSource = getHistoricalSource(goal);
  const historicalSelection: ExternalSelection = historicalSource?.selection ?? [];

  // const [isLoading, setIsLoading] = useState(false);
  // const [visibleForm, setVisibleForm] = useState('manual')

  const [dataSource, setDataSource] = useState<string>(historicalSource?.dataset ?? "");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [table, setTable] = useState<{ tableId: string, label: string } | null>(historicalSource?.tableId ? { label: tables?.find(t => t.tableId === historicalSource.tableId)?.label ?? historicalSource.tableId, tableId: historicalSource.tableId } : null);
  const [startPeriod, setStartPeriod] = useState<string | undefined>(undefined);

  const [tableMetadata, _setTableMetadata] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const [mainTimeDimensionId, setMainTimeDimensionId] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  // const deleteDataRef = useRef<HTMLDialogElement>(null)

  const historicalDatasetLabel = getHistoricalDataset(goal).label;
  const historicalLabel = historicalDatasetLabel
    ? `${historicalDatasetLabel} (${t("common:historical_data")})`
    : t("common:historical_data");

  function getInitialSelectionValue(variableCode: string) {
    const valueCode = historicalSelection.find(selection => selection.variableCode === variableCode)?.valueCodes?.[0];
    if (!valueCode) return undefined;

    const fromMatch = /^FROM\((.+)\)$/i.exec(valueCode);
    return fromMatch?.[1] ?? valueCode;
  }

  const setTableMetadata = useCallback((tableMetadata: ApiTableMetadata | null) => {
    _setTableMetadata(prev => {
      if (!tableMetadata || !(tableMetadata.api === "PxWeb")) {
        // if no metadata, reset the main time dimension id to null
        // Also don't set the main time dimension id if the metadata is not from PxWeb, as only PxWeb should wrap its time variable in a FROM() function
        setMainTimeDimensionId(null);
      } else if (prev?.tableId !== tableMetadata.tableId || prev?.timeDimensions !== tableMetadata.timeDimensions) {
        // when changing table (or updating ), update the main time dimension
        if (tableMetadata.timeDimensions.length === 1) {
          // if there is only one time dimension, set it as the main time dimension
          setMainTimeDimensionId(tableMetadata.timeDimensions[0].id);
        } else {
          // if there are multiple or no time dimensions, set the main time dimension to null to allow the user to select one
          setMainTimeDimensionId(null);
        }
      }
      return tableMetadata;
    });
  }, [_setTableMetadata]);

  const tryGetResult = useCallback((event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    // setIsLoading(true);
    const formData = new FormData(formRef.current);
    const query = formQueryHelper(formData, tableMetadata, mainTimeDimensionId);

    // try to update available selection for trafa metadata
    if (dataSource === "Trafa" && !!table) {
      const changedSelect = event?.target instanceof HTMLSelectElement ? event.target : null;
      // if a select relevant to the current table's dimensions or hierarchy children changed, try to fetch updated metadata for the current table with the new selection
      if (changedSelect && (
        tableMetadata?.metricDimensions.some(metricDimension => metricDimension.id === changedSelect.name)
        || tableMetadata?.regularDimensions.some(variable => variable.id === changedSelect.name)
        || tableMetadata?.timeDimensions.some(variable => variable.id === changedSelect.name)
        || tableMetadata?.hierarchies?.some(hierarchy => hierarchy.children.some(child => child.id === changedSelect.name))
      )) {
        void getTableMetadata(table.tableId, dataSource, query, lang).then(result => { setTableMetadata(result); });
      }
    }

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      getTableContent(table ? table.tableId : "", dataSource, query, lang).then(result => {
        setTableContent(result);
        // setIsLoading(false);
      }).catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table content:", errorMessage);
        setTableContent(null);
        // setIsLoading(false);
      });
    } else {
      setTableContent(null);
      // setIsLoading(false);
    }
  }, [dataSource, lang, mainTimeDimensionId, setTableMetadata, table, tableMetadata]);

  const setFormRef = useCallback((node: HTMLFormElement | null) => {
    if (node) {
      formRef.current = node;
      tryGetResult();
    }
  }, [tryGetResult]);

  // 1. Fetch table metadata
  const initialTableId = historicalSource?.tableId ?? null;
  const initialDataset = historicalSource?.dataset ?? null;
  useEffect(() => {
    if (!initialTableId || !initialDataset) return;

    void getTableMetadata(
      initialTableId,
      initialDataset,
      historicalSelection,
      lang,
    ).then(setTableMetadata);
    // historicalSelection is derived from the same recipe as initialTableId/initialDataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTableId, initialDataset, lang, setTableMetadata]);

  // 2. Fetch table content
  useEffect(() => {
    if (!formRef.current || !tableMetadata) return;
    tryGetResult();
  }, [tableMetadata, tryGetResult]);

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
    setTableMetadata(null);

    void getTableMetadata(tableId, dataSource, undefined, lang).then(result => {
      setTableMetadata(result);
      // setIsLoading(false);
    });
  }, [dataSource, lang, setTableMetadata]);

  useEffect(() => {
    handleTableSelect(!!table?.tableId ? table.tableId : null);
  }, [table, handleTableSelect]);

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean | null | undefined) {
    if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && variableIsOptional) return <span className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</span>;
  }
  
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Return if insufficient selection has been made
    if (!tables) return;
    // Return if properly formatted response was not found
    if (!tableContent) return;
    if (!(event.target instanceof HTMLFormElement)) return;

    if (!(event.target.checkValidity())) return;
    if (!isDataSetKeys(dataSource)) return;
    const formData = new FormData(event.target);
    const query = formQueryHelper(formData, tableMetadata, mainTimeDimensionId);

    const recipe = Recipe.fromExternalSource({
      name: table?.label || dataSource,
      dataset: dataSource,
      tableId: table?.tableId ?? null,
      selection: query,
      variableId: historicalSource?.id,
    });

    formSubmitter("/api/goal", JSON.stringify({
      target: GoalDataTarget.Historical,
      goalId: goal.id,
      historicalRecipe: recipe.serialize(),
      historicalRecipeId: goal.historical?.recipeUsed?.id ?? undefined,
      timestamp: Date.now(),
    } satisfies GoalUpdateInput), "PUT", t); // TODO: add setIsLoading when we reintroduce it
  }

  function shouldVariableFieldsetBeVisible(tableMetadata: ApiTableMetadata, dataSource: string) {
    // Show if there are hierarchies
    if (tableMetadata.hierarchies && tableMetadata.hierarchies.length > 0) return true;
    // Show if there is a selection to be made for any regular dimension
    if (tableMetadata.regularDimensions.some(variable => variable.options.length > 1)) return true;
    // If the data source is not PxWeb, we do not set default value on selects with only one option (why?), so we show the fieldset if any regular dimension has options
    if (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableMetadata.regularDimensions.some(variable => variable.options.length > 0)) return true;
    // Show if any time dimension has more than one option
    if (tableMetadata.timeDimensions.some(time => time.options.length > 1)) return true;
    return false;
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  const values = tableContent?.values.filter(({ period }) => !startPeriod || period >= startPeriod) ?? [];
  const historicalEntries = values
    .map(({ period, value }) => [new Date(period), Number(value)] as [Date, number])
    .sort((a, b) => a[0].getTime() - b[0].getTime());
  const pad = (n: number) => String(n).padStart(2, "0");
  const historicalSeries: DateValues = Object.fromEntries(
    historicalEntries.map(([date, value]) => [
      `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T00:00:00Z`,
      value,
    ]),
  ) as DateValues;

  return (
    <div>
      {/* <p className="padding-inline-100">{t("components:query_builder.add_data_to_goal", { goalName: goal.name ?? goal.indicatorParameter })}</p> */}

      {/* TODO: It might be sensible if these are tabs instead. Additionally that we warn users that data will be deleted given that you switch between them 
      {/* TODO: Make sure these wrap
      <div className="radio-select-two margin-bottom-100"> 
        <label id="recipe-type-suggested-label">
          {t("components:query_builder.adjust_data_manually")}
          <input
            className="margin-right-25"
            type="radio"
            name="visible-form"
            id="visible-form-manual"
            value="manual"
            checked={visibleForm === "manual"}
            onChange={() => setVisibleForm("manual")}
          />
        </label>
        <span>&#8210; {t("common:tsx.or")} &#8210;</span>
        <label>
          {t("components:query_builder.add_external_data")}
          <input
            className="margin-right-25"
            type="radio"
            name="visible-form"
            id="visible-form-external"
            value="external"
            checked={visibleForm === "external"}
            onChange={() => setVisibleForm("external")}
          />
        </label>
      </div>
       */}

      {/*
      {visibleForm === 'manual' ?
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend
            // Technically incrementing here is unused but if you add a another entry after this one it will be correct
            // eslint-disable-next-line no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            Data {/* TODO: I18n 
          </legend>
          <DataSeriesInputManual />
        </fieldset>
        : visibleForm === 'external' ? (
      */}

      <form
        ref={setFormRef}
        onSubmit={handleSubmit}
        className={`${styles['historical-data']}`}
      >
        {/* Hidden disabled submit button to prevent accidental submission */}
        <button type="submit" className="display-none" disabled={true}></button>

        <fieldset
          // disabled={goal.externalDataset && goal.externalTableId ? true : false} 
          className={`${styles.timeLineFieldset} width-100 min-width-0`}
        >
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>
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
                setTableContent(null);
                setTableMetadata(null);
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

        {/* TODO - which inputs should be optional? */}
        <fieldset
          className={`${styles.timeLineFieldset} width-100 margin-top-200 min-width-0`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("components:query_builder.select_metric_for_table")}
          </legend>
          {table && tableMetadata ? (
            tableMetadata.metricDimensions?.map((metricDimension) => (
              metricSelectionHelper({
                t,
                metricDimension,
                tableMetadata,
                dataSource,
                tryGetResult,
                getInitialSelectionValue,
              })
            ))
          ) : (
            <p className="margin-0 margin-bottom-100">
              {t("components:query_builder.select_source_for_metric")}
            </p>
          )}
        </fieldset>

        <fieldset
          name="variableSelectionFieldset"
          className={`${styles.timeLineFieldset} width-100 margin-top-200 min-width-0`}
        >
          <legend
            // eslint-disable-next-line no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("components:query_builder.select_values_for_table")}
          </legend>
          {tableMetadata &&
            shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? (
            <div>
              {tableMetadata.timeDimensions?.map(time => {
                return timeVariableSelectionHelper({
                  t,
                  language: tableMetadata.language,
                  time,
                  dataSource,
                  optionalTag,
                  tryGetResult,
                  setStartPeriod,
                  getInitialSelectionValue,
                });
              })}
              {tableMetadata.regularDimensions.map(variable => {
                return variableSelectionHelper({
                  t,
                  dimension: variable,
                  tableMetadata,
                  historicalSelection,
                  dataSource,
                  optionalTag,
                  tryGetResult,
                });
              })}
              {tableMetadata.hierarchies?.map(hierarchy => {
                if (!hierarchy.children?.some(variable => variable.options.length > 0)) return null;
                return (
                  <div key={hierarchy.name}>
                    <div className="font-weight-bold">{hierarchy.label}</div>
                    <div className="block margin-block-75 margin-left-75">
                      {hierarchy.children?.map(variable => {
                        return variableSelectionHelper({
                          t,
                          dimension: variable,
                          tableMetadata,
                          historicalSelection,
                          dataSource,
                          optionalTag,
                          tryGetResult,
                        });
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`font-style-italic color-gray`}>{t("components:query_builder.no_variables_found")}</p> /* TODO: Text should be made clearer, e.g "no variables exist for this table..."" */
          )}

          { /* : (
            <p>Välj ett mätvärde först</p>  
          )}*/}
        </fieldset>

        <section className="block padding-bottom-100 position-relative min-width-0 margin-top-200">
          <h2 className="padding-block-125">{t("components:query_builder.preview_values")}</h2>
          {tableContent && tableContent.values.length > 0 ? (
            <TabList
              defaultIndex={0}
            >
              <div
                data-tabname="table-preview"
                className="padding-50 smooth"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--gray-80)',
                }}
              >
                <table className={`${styles['preview-table']}`}>
                  <thead>
                    <tr>
                      <th scope="col">{t("components:query_builder.period")}</th>
                      <th scope="col">{t("components:query_builder.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      tableContent.values
                        .filter(({ period }) => !startPeriod || period >= startPeriod)
                        .map(({ period, value }) => (
                          <tr key={period}>
                            <td>{period}</td>
                            <td>{value}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
              <div
                data-tabname="graph-preview"
                className="padding-50 smooth"
                style={{
                  backgroundColor: 'white',
                  height: '450px',
                  border: '1px solid var(--gray-80)',
                }}
              >
                <GoalGraph // TODO: Include parentgoal?
                  chartType="main"
                  series={{
                    main: goal.dataSeries && {
                      name: `${(goal.name || goal.indicatorParameter).split('\\').slice(-1)[0]} (${t("common:goal_one")})`,
                      unit: goal.dataSeries.unit,
                      dateValues: Object.fromEntries(
                        goal.dataSeries.values.map((value) => [
                          value.timestamp.toISOString(),
                          value.value,
                        ]),
                      ),
                    },
                    baseline: goal.baseline && {
                      name: t("graphs:common.baseline_scenario"),
                      unit: goal.baseline.unit,
                      dateValues: Object.fromEntries(
                        goal.baseline.values.map((value) => [
                          value.timestamp.toISOString(),
                          value.value,
                        ]),
                      ),
                    },
                    historical: historicalSeries && {
                      name: goal.historical ? historicalLabel : "",
                      unit: goal.historical?.unit ?? "", // TODO: This and name should be conditional on if goal has historical data or if it should be taken from this form! (or it could possibly always be taken from this form as stuff is filled in if the data exists in the goal?)
                      dateValues: historicalSeries,
                    },
                    predictedOutcome: goal.effects.length > 0
                      ? {
                        name: t("graphs:common.expected_outcome"),
                        // TODO: Not good if there are multiple different units for different effects.
                        // We likely want some conversion or warning, this includes units that differ between
                        // historical, baseline and main dataseries aswell!
                        unit: goal.effects[0].dataSeries?.unit,
                        dateValues: Object.fromEntries(
                          calculatePredictedOutcome(goal.effects, goal.baseline)
                            .filter((point): point is { x: number; y: number } => point.y !== null)
                            .map((point) => [new Date(point.x).toISOString(), point.y]),
                        ),
                      }
                      : null,
                  }}
                />
              </div>
            </TabList>
          ) : (
            <p className="padding-100">{t("components:query_builder.no_result_found")}</p>
          )}
        </section>

        <div className="margin-top-400 padding-top-100 margin-bottom-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
          <button
            id="submit-button"
            type="submit"
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: "14px", transform: "none" }}
            disabled={!tableMetadata || !tableContent || !dataSource}
          >
            {t("common:tsx.save_changes")}
          </button>
        </div>


      </form>
    </div>
  );
};