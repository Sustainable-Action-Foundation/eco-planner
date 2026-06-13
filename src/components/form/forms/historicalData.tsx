"use client";

import formSubmitter from "@/functions/formSubmitter";
import type { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { ExternalDataset, isDataSetKeys } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { PxWebTimeVariable, PxWebVariable } from "@/lib/pxWeb/pxWebApiV2Types";
import type { TrafaVariable } from "@/lib/trafa/trafaTypes";
import type { Goal } from "@/types";
import { Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe";
import type { ExternalVariable } from "@/functions/recipe";
import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import type { SubmitEvent } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
// import dialogStyles from '../api/queryBuilder.module.css' /* TODO: This seems a bit janky */
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
// import { IconEdit, IconTrashXFilled, IconX } from "@tabler/icons-react";

type ExternalSelection = NonNullable<Parameters<typeof getTableDetails>[2]>;

// TODO: Stuff is re-rendering like a bajillion times, fix this.
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
  const [metric, setMetric] = useState<string | null>(() => historicalSelection[0]?.valueCodes?.[0] ?? null);

  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
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
      }).catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
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

  const setFormRef = useCallback((node: HTMLFormElement | null) => {
    if (node) {
      formRef.current = node;
      tryGetResult();
    }
  }, [tryGetResult]);

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
            onChange={() => tryGetResult()}
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
    const query = buildQuery(formData);

    // Reuse the existing external variable's id (if any) so the recipe equation
    // stays stable across edits.
    const variableId = historicalSource?.id ?? crypto.randomUUID();
    const externalVariable: ExternalVariable = {
      id: variableId,
      name: table?.label || dataSource,
      type: RecipeDataTypes.External,
      pick: VectorIndexPickerOptions.Default,
      unit: undefined,
      dataset: dataSource,
      tableId: table?.tableId ?? null,
      selection: query,
    };
    const recipe = new Recipe({
      name: table?.label || dataSource,
      equation: `\${${variableId}}`,
      variables: [externalVariable],
    });

    // Update the goal with the new historical recipe. The server fetches the
    // external data into the goal's `historical` DataSeries, keeping the
    // selection editable.
    formSubmitter("/api/goal", JSON.stringify({
      goalId: goal.id,
      historicalRecipe: recipe.serialize(),
      historicalRecipeId: goal.historical?.recipeUsed?.id ?? undefined,
      timestamp: Date.now(),
    }), "PUT", t); // TODO: add setIsLoading when we reintroduce it
  }

  {/* TODO: Temprorarily removed as we won't have manual historical data on release. This should still exist though, so re add
  function deleteHistoricalData() {
    formSubmitter("/api/goal", JSON.stringify({
      goalId: goal.id,
      externalDataset: null,
      externalTableId: null,
      externalSelection: null,
      timestamp: Date.now(),
    }), "PUT", t, setIsLoading);
  }
  */}

  function shouldVariableFieldsetBeVisible(tableDetails: ApiTableDetails, dataSource: string) {
    const returnBool = ((tableDetails.hierarchies && tableDetails.hierarchies.length > 0) || (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableDetails.variables.some(variable => variable.option)) || tableDetails.times.length > 1);
    return returnBool;
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  {/* TODO: Must make sure to limit the width of selects, some variables are stupidly long */ }
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
      {/* TODO: A bunch of i18n
            TODO: We should likely not be adding a blur to the backdrop if our dialog can be light dismissed, i.e closedby=any
            TODO: dialog loading state (for the remove button)
            {goal.externalDataset && goal.externalTableId ?
              <>
                <fieldset data-info className={`${styles.timeLineFieldset} fieldset-unset-pseudo-class width-100 margin-top-200`}>
                  <legend className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>
                    Information 
                  </legend>
                  <p className="margin-0 font-weight-500">
                    Denna målbana har redan en extern datakälla. Du kan antingen justera din historiska data manuellt eller ta bort den externa datakällan och lägga till en ny 
                  </p> 
                  <div className="flex gap-25 margin-top-100">
                    <button
                      className="flex-grow-100 flex align-items-center justify-content-space-between gap-25 font-weight-500"
                      style={{ transform: 'scale(1)' }}
                      onClick={() => setVisibleForm("manual")}
                    >
                      Justera manuellt
                      <IconEdit width={18} height={18} style={{ minWidth: '18px' }} aria-hidden="true" />
                    </button>
                    <button type="button" className="red color-purewhite flex align-items-center justify-content-space-between gap-100 font-weight-500" style={{ transform: 'scale(1)' }} onClick={() => deleteDataRef.current?.showModal()}>
                      Ta bort extern datakälla
                      <IconTrashXFilled fill='white' width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
                    </button>
                  </div>
                </fieldset>

                <dialog closedby="any" style={{ width: 'min(75ch, 100%)', height: 'calc(50vh - 2rem)' }} className={`rounded padding-inline-0 padding-block-0 ${dialogStyles.dialog}`} aria-modal ref={deleteDataRef}>
                  <div className={`${dialogStyles['dialog-content']}`}>
                    <div className={`${dialogStyles['dialog-header']}`}>
                      <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => deleteDataRef.current?.close()} autoFocus aria-label={t("common:tsx.close")} >
                        <IconX strokeWidth={3} width={28} height={28} style={{ minWidth: '28px' }} aria-hidden="true" />
                      </button>
                      <h2 className="margin-0">Ta bort extern datakälla</h2> 
                    </div>
                    <div className="padding-100 flex flex-direction-column">
                      <p className="margin-0 flex-grow-100">Är du säker på att du vill ta bort extern datakälla: <span style={{ fontStyle: 'italic' }}>{tables?.find(t => t.tableId === goal.externalTableId)?.label ?? goal.externalTableId}({goal.externalDataset})</span> från målbana: <span className="font-weight-600">{goal.name}</span>?</p>
                      <div className="flex gap-25">
                        <button className="flex-grow-100 font-weight-500" onClick={() => deleteDataRef.current?.close()}>
                          Avbryt
                        </button>
                        <button type="button" className="color-purewhite red font-weight-500" onClick={deleteHistoricalData}> 
                          Ta bort extern datakälla
                        </button>
                      </div>
                    </div>
                  </div>
                </dialog>
              </>
              : null}
            */}

      <form
        ref={setFormRef}
        onSubmit={handleSubmit}
        className="flex flex-direction-column flex-grow-1"
        style={{ minHeight: '0' }}
      >
        {/* Hidden disabled submit button to prevent accidental submission */}
        <button type="submit" className="display-none" disabled={true}></button>

        <fieldset
          // disabled={goal.externalDataset && goal.externalTableId ? true : false} 
          className={`${styles.timeLineFieldset} width-100`} // margin-top-200
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
          <SelectSingleSearch // TODO: Deal with width
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
          // disabled={goal.externalDataset && goal.externalTableId ? true : false} 
          className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
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
            <p>{t("components:query_builder.select_source_for_metric")}</p>
          )}
        </fieldset>

        <fieldset
          // disabled={goal.externalDataset && goal.externalTableId && goal.externalSelection ? true : false}
          name="variableSelectionFieldset"
          className={`${styles.timeLineFieldset} width-100 margin-top-200`}
        > {/* Figure out disabled for this form */}
          <legend
            // Technically incrementing here is unused but if you add a another entry after this one it will be correct
            // eslint-disable-next-line no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("components:query_builder.select_values_for_table")}
          </legend>
          {tableDetails &&
            shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? (
            <div>
              {tableDetails.times ? timeVariableSelectionHelper(tableDetails.times, tableDetails.language) : null
              }
              {tableDetails.variables.map(variable => {
                return variableSelectionHelper(variable, tableDetails);
              })}
              {tableDetails.hierarchies?.map(hierarchy => {
                if (hierarchy.children?.some(variable => variable.option)) return (
                  <div key={hierarchy.name}>
                    <div className="font-weight-bold">{hierarchy.label}</div>
                    <div className="block margin-block-75 margin-left-75">
                      {hierarchy.children?.map(variable => {
                        return variableSelectionHelper(variable, tableDetails);
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
        <output className="block padding-bottom-100">
          {/* TODO: style this better */}
          {tableContent && tableContent.values.length > 0 ? (
            <div>
              <p>{t("components:query_builder.does_this_look_correct", { count: 5 })}</p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("components:query_builder.period")}</th>
                    <th scope="col">{t("components:query_builder.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {
                    tableContent.values.map(({ period, value }, rowIndex) => {
                      return (
                        rowIndex < 5 &&
                        <tr key={period}>
                          <td>{period}</td>
                          <td>{value}</td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
          ) :
            (
              <p className="padding-100">{t("components:query_builder.no_result_found")}</p>
            )
          }
        </output>
        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: "1px solid var(--gray-80)" }}>
          <button
            id="submit-button"
            type="submit"
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: "14px", transform: "none" }}
            disabled={!tableDetails || !tableContent || !dataSource}
          >
            {t("common:tsx.save_changes")}
          </button>
        </div>
      </form>
      {/*) : null}  */}
    </div>
  );
}