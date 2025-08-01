"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import formSubmitter from "@/functions/formSubmitter";
import { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { externalDatasets, getDatasetKeysOfApis } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient.tsx";
import { PxWebTimeVariable, PxWebVariable } from "@/lib/pxWeb/pxWebApiV2Types";
import { TrafaVariable } from "@/lib/trafa/trafaTypes";
import { Goal } from "@prisma/client";
import { FormEvent, useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";
import { IconChartHistogram, IconSearch, IconTrashXFilled, IconX } from "@tabler/icons-react";

export default function QueryBuilder({
  goal,
}: {
  goal: Goal,
}) {
  const { t } = useTranslation("components");
  // Locale has the format language-locale, e.g. "sv-SE" or "en-US"
  // We only need the language part, so we split it and take the first part
  // TODO: Fix typing, use match() instead of casting
  const lang = useContext(LocaleContext).split("-")[0];
  // const lang = useContext(LocaleContext).split("-")[0] as "sv" | "en";

  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>("");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [renderedTables, setRenderedTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [defaultMetricSelected, setDefaultMetricSelected] = useState(true);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const tableSearchInputName = "tableSearch";

  // These variables determine how many tables are rendered at a time, and how many are rendered when the user scrolls down/up
  // The first number is the amount of tables that are rendered when the user scrolls down/up, and the second number is the maximum amount of tables that are rendered at once.
  // The initial rendering margin allows for more than the maximum amount of tables to be rendered at once if the total amount of tables is less than the maximum amount of tables plus the margin (currently adding to 115).
  const tablesListRenderingChunkSize = 50;
  const renderedTablesListMaxLength = 100;
  const initialRenderingMargin = 15;

  useEffect(() => {
    if (!dataSource) return;
    setIsLoading(true);
    /* console.time("getTables"); */
    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getTables(dataSource, query, lang).then(result => { setTables(result); setIsLoading(false); /* console.timeEnd("getTables"); */ });
  }, [dataSource, lang]);

  useEffect(() => {
    if (tables) {
      setRenderedTables(tables
        .slice(
          0,
          /* If the total amount of tables is less than, or equal to, the max amount of rendered tables plus a margin (currently adding to 115), show all tables */
          tables.length <= renderedTablesListMaxLength + initialRenderingMargin
            ?
            tables.length
            : /* Otherwise, only show the first (100) tables. */
            renderedTablesListMaxLength
        ));
      setOffset(0);
    } else {
      setRenderedTables(null);
      setOffset(0);
    }
  }, [tables]);

  useEffect(() => {
    const loader = document?.getElementById("loader");
    if (isLoading && loader) {
      loader.classList.remove("hidden");
    } else if (!isLoading && loader) {
      setTimeout(() => {
        loader.classList.add("hidden");
      }, 0);
    }
  }, [isLoading]);

  useEffect(() => {
    const metricSelectElement = document.getElementById("metric") as HTMLSelectElement | null;
    if (metricSelectElement) {
      setDefaultMetricSelected(metricSelectElement.value.length == 0);
    } else {
      setDefaultMetricSelected(true);
    }
  }, [tableDetails]);

  function buildQuery(formData: FormData) {
    const queryObject: { variableCode: string, valueCodes: string[] }[] = [];
    formData.forEach((value, key) => {
      // Skip empty values
      if (!value) return;
      // Skip File inputs
      if (value instanceof File) return;
      // Skip externalDataset, externalTableId, and `tableSearchInputName`, as they are not part of the query
      if (key == "externalDataset") return;
      if (key == "externalTableId") return;
      if (key == tableSearchInputName) return;
      // The PxWeb time variable is special, as we want to fetch every period after (and including) the selected one
      if (getDatasetKeysOfApis("PxWeb").includes(dataSource) && key == formRef.current?.getElementsByClassName("TimeVariable")[0]?.id) {
        queryObject.push({ variableCode: key, valueCodes: [`FROM(${value})`] });
        return;
      }
      queryObject.push({ variableCode: key, valueCodes: [value] });
    });

    return queryObject;
  }

  function deleteHistoricalData() {
    formSubmitter("/api/goal", JSON.stringify({
      goalId: goal.id,
      externalDataset: null,
      externalTableId: null,
      externalSelection: null,
      timestamp: Date.now(),
    }), "PUT", t, setIsLoading);
    closeModal(modalRef);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Return if insufficient selection has been made
    if (!tables) return;
    // Return if properly formatted response was not found
    if (!tableContent) return;
    if (!(event.target instanceof HTMLFormElement)) return;

    if (!(event.target.checkValidity())) return;
    const formData = new FormData(event.target);
    const query = buildQuery(formData);

    // Update the goal with the new data
    formSubmitter("/api/goal", JSON.stringify({
      goalId: goal.id,
      externalDataset: dataSource,
      externalTableId: formData.get("externalTableId"),
      externalSelection: JSON.stringify(query),
      timestamp: Date.now(),
    }), "PUT", t, setIsLoading);
  }

  function enableSubmitButton() {
    const submitButton = document?.getElementById("submit-button");
    if (submitButton) {
      submitButton.removeAttribute("disabled");
      if (submitButton.classList.contains("display-none")) submitButton.classList.remove("display-none");
      if (submitButton.classList.contains("height-0")) submitButton.classList.remove("height-0");
      if (submitButton.classList.contains("padding-0")) submitButton.classList.remove("padding-0");
    }
  }

  function disableSubmitButton() {
    const submitButton = document?.getElementById("submit-button");
    if (submitButton) {
      submitButton.setAttribute("disabled", "true");
      if (!submitButton.classList.contains("display-none")) submitButton.classList.add("display-none");
      if (!submitButton.classList.contains("height-0")) submitButton.classList.add("height-0");
      if (!submitButton.classList.contains("padding-0")) submitButton.classList.add("padding-0");
    }
  }

  function tryGetResult(event?: React.ChangeEvent<HTMLSelectElement> | FormEvent<HTMLFormElement> | Event) {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    /* console.time("tryGetResult"); */
    setIsLoading(true);

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData);
      const tableId = tableDetails?.id ?? formData.get("externalTableId") as string ?? "";
      getTableContent(tableId, dataSource, query, lang).then(result => {
        setTableContent(result);
        if ((result?.data.length ?? 0) > 0) {
          enableSubmitButton();
        } else {
          disableSubmitButton();
        }
        /* console.timeEnd("tryGetResult"); */
        setIsLoading(false);
      });
      if (dataSource == "Trafa") {
        // If metric was changed, only send the metric as a query to the API
        if (event?.target instanceof HTMLSelectElement && event.target.name == "metric") {
          getTableDetails(tableId, dataSource, query.filter(q => q.variableCode == "metric"), lang).then(result => { setTableDetails(result); });
        } else {
          getTableDetails(tableId, dataSource, query, lang).then(result => { setTableDetails(result); });
        }
      }
    }
    // If not, make sure the submit button is disabled
    else {
      disableSubmitButton();
      clearTableContent();
      /* console.timeEnd("tryGetResult"); */
      setIsLoading(false);
    }
  }
  function formChange(event: React.ChangeEvent<HTMLSelectElement> | FormEvent<HTMLFormElement> | Event) {
    const changedElementIsExternalDataset = event.target instanceof HTMLSelectElement && (event.target as HTMLSelectElement).name == "externalDataset";
    const changedElementIsTableSearch = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "tableSearch";
    const changedElementIsTable = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "externalTableId";

    /* console.log(tableDetails); */
    if (!changedElementIsExternalDataset && !changedElementIsTableSearch && !changedElementIsTable && tables && tableDetails) {
      tryGetResult(event);
    }
  }

  function searchOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleSearch((event.target as HTMLInputElement).value);
    }
  }

  function searchWithButton() {
    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;
    handleSearch(query ?? undefined);
  }

  function handleSearch(query?: string) {
    if (!externalDatasets[dataSource]?.baseUrl) return;

    getTables(dataSource, query, lang).then(result => setTables(result));
  }

  function clearTableDetails() {
    setTableDetails(null);
  }

  function clearTableContent() {
    setTableContent(null);
  }

  function handleDataSourceSelect(dataSource: string) {
    setDataSource(dataSource);
    // Clear table details and content whenever the data source changes
    clearTableContent();
    clearTableDetails();
    // Make sure submit button is disabled when the data source is changed
    disableSubmitButton();
  }

  function handleTableSelect(tableId: string) {
    /* console.time("tableSelect"); */
    setIsLoading(true);

    if (!externalDatasets[dataSource]?.baseUrl) return;
    if (!tableId) return;

    clearTableContent();
    clearTableDetails();
    disableSubmitButton();

    getTableDetails(tableId, dataSource, undefined, lang).then(result => { setTableDetails(result); /* console.timeEnd("tableSelect"); */ setIsLoading(false); });
  }

  function handleMetricSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    setIsLoading(true);
    const isDefaultValue = event.target.value.length == 0;
    setDefaultMetricSelected(isDefaultValue);
    const variableSelectionFieldSets = document?.getElementsByName("variableSelectionFieldset");

    if (variableSelectionFieldSets.length > 0) {
      variableSelectionFieldSets.forEach(variableSelectionFieldset => {
        if (!isDefaultValue && variableSelectionFieldset.hasAttribute("disabled")) {
          variableSelectionFieldset.removeAttribute("disabled");
        }
        else if (isDefaultValue) {
          // Reset the selection of all select elements in the variable fieldset before disabling
          variableSelectionFieldset.querySelectorAll("select").forEach(select => {
            select.value = "";
          });
          variableSelectionFieldset.setAttribute("disabled", "true");
          // Reset all the table details when disabling the form so all options are displayed when re-enabling
          if (dataSource == "Trafa") {
            getTableDetails(tableDetails?.id ?? "", dataSource, undefined, lang).then(result => { setTableDetails(result); setIsLoading(false); });
          }
          else {
            setIsLoading(false);
          }
        }
      });
    } else {
      /* console.log("no variable selection fieldset found"); */
      setIsLoading(false);
    }
  }

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean) {
    if (getDatasetKeysOfApis("PxWeb").includes(dataSource) && variableIsOptional) return <span className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</span>;
  }

  function handleTableListScroll(event: React.UIEvent<HTMLUListElement, UIEvent>) {
    if (event.target && event.target instanceof HTMLElement && tables && event.target.children.length < tables.length) {
      if ( // This block is only executed when the user scrolls down
        renderedTables
        &&
        /* Check if the user has scrolled far enough to render more tables (including some margin so the scroll does not get stuck at the bottom while waiting for more tables to render) */
        event.target.scrollTop + event.target.clientHeight * 2 >= event.target.scrollHeight
        &&
        /* Make sure that the very last table has not been rendered */
        !renderedTables.includes(tables[tables.length - 1])
      ) {
        const newOffset = offset + tablesListRenderingChunkSize;
        const newRenderedTables = tables.slice(newOffset, newOffset + renderedTablesListMaxLength);
        setRenderedTables(newRenderedTables);
        setOffset(newOffset);
      }
      else if ( // This block is only executed when the user scrolls up
        renderedTables
        &&
        /* Check if the user has scrolled far enough to render more tables (including some margin so the scroll does not get stuck at the top while waiting for more tables to render) */
        event.target.scrollTop < event.target.clientHeight * 2
        &&
        /* Check that the very first table has not been rendered */
        !renderedTables.includes(tables[0])
      ) {
        const newOffset = Math.max(offset - tablesListRenderingChunkSize, 0);
        const newRenderedTables = tables.slice(newOffset, newOffset + renderedTablesListMaxLength);
        setRenderedTables(newRenderedTables);
        setOffset(newOffset);
      }
    }
  }

  type VariableSelectionHelperOptions = {
    classNames?: string[],
  }
  function variableSelectionHelper(variable: TrafaVariable | PxWebVariable, tableDetails: ApiTableDetails, options?: VariableSelectionHelperOptions) {
    if (variable.option) {
      return (
        <label key={variable.name} className={`block margin-block-75 ${options?.classNames && (options?.classNames as string[]).map((className: string) => className).join(" ")}`}>
          {// Only display "optional" tags if the data source provides this information
          }
          {variable.label[0].toUpperCase() + variable.label.slice(1)}{optionalTag(dataSource, variable.optional)}
          {// TODO: Use CSS to set proper capitalization of labels; something like `label::first-letter { text-transform: capitalize; }`}
          }
          <select className={`block margin-block-25 ${variable.label}`}
            required={!variable.optional}
            name={variable.name}
            id={variable.name}
            defaultValue={getDatasetKeysOfApis("PxWeb").includes(dataSource) ?
              (// If only one value is available, pre-select it
                variable.values && variable.values.length == 1 ? variable.values[0].label : undefined
              )
              :
              undefined
            }>
            { // If only one value is available, don't show a placeholder option
              getDatasetKeysOfApis("PxWeb").includes(dataSource) && variable.values && variable.values.length > 1 &&
              <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option>
            }
            {
              !getDatasetKeysOfApis("PxWeb").includes(dataSource) &&
              <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option>
            }
            {variable.values && variable.values.map(value => (
              <option key={`${variable.name}-${value.name}`} value={value.name} lang={tableDetails.language}>{value.label}</option>
            ))}
          </select>
        </label>
      )
    } else if (dataSource == "Trafa" && !variable.option && (variable as TrafaVariable).selected) {
      console.warn("The variable is selected while it is not an option. This should not happen.");
    }
  }

  function timeVariableSelectionHelper(times: (TrafaVariable | PxWebTimeVariable)[], language?: string) {
    if ((dataSource == "Trafa" && !(times.length == 1 && times[0].name == "ar")) || (getDatasetKeysOfApis("PxWeb").includes(dataSource) && times.length > 1)) {
      let heading = "";
      let defaultValue = "";
      let displayValueKey: keyof typeof times[0]/* "label" | "id" | "name" | "type" */ = "id";
      const variableIsOptional = times[0].optional;
      if (dataSource == "Trafa") {
        // heading = "Välj tidsintervall";
        heading = t("components:query_builder.select_time_interval");
        // defaultValue = "Välj tidsintervall";
        defaultValue = t("components:query_builder.select_time_interval");
        displayValueKey = "label";
      } else if (getDatasetKeysOfApis("PxWeb").includes(dataSource)) {
        // heading = "Välj startperiod";
        heading = t("components:query_builder.select_starting_period");
        // defaultValue = "Välj tidsperiod";
        defaultValue = t("components:query_builder.select_time_period");
        displayValueKey = "id";
      }
      return (<label key="Tid" className="block margin-block-75">
        {heading}{optionalTag(dataSource, variableIsOptional)}
        <select className={`block margin-block-25 TimeVariable`}
          required={false}
          name="Tid"
          id="Tid"
          defaultValue={times && times.length == 1 ? times[0].label : undefined}>
          <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
          {times.map(time => (
            <option key={time.name} value={time.name} lang={language}>{time[displayValueKey]}</option>
          ))}
        </select>
      </label>)
    }
  }

  function shouldVariableFieldsetBeVisible(tableDetails: ApiTableDetails, dataSource: string) {
    const returnBool = ((tableDetails.hierarchies && tableDetails.hierarchies.length > 0) || (!getDatasetKeysOfApis("PxWeb").includes(dataSource) && tableDetails.variables.some(variable => variable.option)) || tableDetails.times.length > 1);
    return returnBool;
  }

  return (
    <>
      {goal.externalDataset && goal.externalTableId
        ?
        <>
          <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={() => openModal(modalRef)}>
            {t("components:query_builder.change_historical_data")}
            <IconChartHistogram width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
          </button>

          <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={deleteHistoricalData}>
            {t("components:query_builder.remove_historical_data")}
            <IconTrashXFilled fill='#CB3C3C' width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
          </button>
        </>
        :
        <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={() => openModal(modalRef)}>
          {t("components:query_builder.add_historical_data")}
          <IconChartHistogram width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />

        </button>
      }

      <dialog className={`smooth padding-inline-0 ${styles.dialog}`} ref={modalRef} aria-modal>
        <div className="display-flex flex-direction-row-reverse align-items-center justify-content-space-between padding-inline-100">
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label={t("common:tsx.close")} >
            <IconX strokeWidth={3} width={18} height={18} style={{ minWidth: '18px' }} aria-hidden="true" />
          </button>
          <h2 className="margin-0">{t("components:query_builder.add_data_source")}</h2>
        </div>

        <p className="padding-inline-100">{t("components:query_builder.add_data_to_goal", { goalName: goal.name ?? goal.indicatorParameter })}</p>

        <form ref={formRef} onChange={formChange} onSubmit={handleSubmit}>
          {/* Hidden disabled submit button to prevent accidental submission */}
          <button type="submit" className="display-none" disabled></button>
          <strong
            id="loader"
            className={`position-absolute gray-80 padding-100 smooth ${!isLoading && "hidden"}`}
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 100, opacity: "0.75" }}>
            {t("components:query_builder.loading")}
          </strong>

          <FormWrapper>
            <fieldset className="position-relative">
              <label className="margin-block-75 font-weight-500">
                {t("components:query_builder.data_source")}
                {/* Display warning message if the selected language is not supported by the api */}
                {((externalDatasets[dataSource]) && !(externalDatasets[dataSource]?.supportedLanguages.includes(lang))) ?
                  <small className="font-weight-normal font-style-italic margin-left-50" style={{ color: "red" }}>{t("components:query_builder.language_support_warning", { dataSource: dataSource })}</small>
                  : null}
                <select className="block margin-block-25 width-100" required name="externalDataset" id="externalDataset" onChange={e => { handleDataSourceSelect(e.target.value) }}>
                  <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_source")}</option>
                  {Object.keys(externalDatasets).map((name) => (
                    <option key={name} value={name}>{externalDatasets[name]?.fullName}</option>
                  ))}
                </select>


              </label>

              {dataSource ?
                <>
                  <div className="margin-top-100 margin-bottom-25">
                    {/* TODO: Label currently affects multiple elements, fix this */}
                    <label className="font-weight-500">
                      {t("components:query_builder.search_for_table")}
                      <div className="focusable gray-90 flex align-items-center margin-top-25 padding-left-50 smooth">
                        <IconSearch strokeWidth={1.5} style={{ minWidth: '24px' }} aria-hidden="true" />
                        <input name={tableSearchInputName} type="search" className="padding-0 margin-inline-50" onKeyDown={searchOnEnter} style={{ backgroundColor: "transparent" }} />
                        <button type="button" onClick={searchWithButton} className="padding-block-50 padding-inline-100 transparent font-weight-500">{t("components:query_builder.search")}</button>
                      </div>
                    </label>
                  </div>

                  <ul
                    id="tablesList"
                    className={`position-relative padding-25 smooth ${styles.temporary}`} onScroll={e => handleTableListScroll(e)}
                    style={{ maxHeight: "300px", border: "1px solid var(--gray-90)", listStyle: "none" }} >
                    {renderedTables && renderedTables.map(({ tableId: id, label }) => (
                      <li
                        key={id}
                        id={`table${id}`}
                        className={`${styles.tableSelect} block padding-block-25`}
                      >
                        {label}
                        <input
                          type="radio"
                          value={id}
                          name="externalTableId"
                          onClick={e => handleTableSelect((e.target as HTMLButtonElement).value)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
                : null}

            </fieldset>

            {tableDetails && (
              // TODO - which inputs should be optional?
              <>
                <label className="block margin-block-75">
                  <Trans
                    i18nKey={"components:query_builder.selected_table"}
                    values={{ table: document.getElementById(`table${tableDetails.id}`)?.innerText }}
                    components={{ strong: <strong />, small: <small />, i: <i /> }}
                  />
                  {/* {t("components:query_builder.selected_table", { table: document.getElementById(`table${tableDetails.id}`)?.innerText })} */}
                </label>
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                  <legend className="padding-inline-50">
                    <b>{t("components:query_builder.select_metric_for_table")}</b>
                  </legend>
                  <div>
                    <label key={`metric-${tableDetails.id}`} className="block margin-block-75">
                      <select className={`block margin-block-25 metric`}
                        required={true}
                        name="metric"
                        id="metric"
                        defaultValue={undefined}
                        onChange={handleMetricSelect}>
                        <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_metric")}</option>
                        {tableDetails.metrics && tableDetails.metrics.map(metric => (
                          <option key={metric.name} value={metric.name} lang={tableDetails.language}>{metric.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
                <fieldset name="variableSelectionFieldset" disabled={true} className={`margin-block-100 smooth padding-25 fieldset-unset-pseudo-class`} style={{ border: `${shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? "1px solid var(--gray-90)" : ""}`, maxHeight: "322px" }}>
                  {shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? (
                    <>
                      <legend className="padding-inline-50">
                        <b>{t("components:query_builder.select_values_for_table")}</b>
                      </legend>
                      <div className={`${styles.temporary}`} style={{ maxHeight: "282px", boxSizing: "content-box", padding: ".25rem", paddingRight: ".375rem" }}>
                        {tableDetails.times &&
                          timeVariableSelectionHelper(tableDetails.times, tableDetails.language)
                        }
                        {tableDetails.variables.map(variable => {
                          return variableSelectionHelper(variable, tableDetails);
                        })}
                        {tableDetails.hierarchies && tableDetails.hierarchies.map(hierarchy => {
                          if (hierarchy.children?.some(variable => variable.option)) return (
                            <label key={hierarchy.name} className="block margin-block-75">
                              <b>{hierarchy.label}</b>
                              {hierarchy.children && hierarchy.children.map(variable => {
                                return variableSelectionHelper(variable, tableDetails, { classNames: ["margin-left-75"] });
                              })}
                            </label>
                          )
                        })}
                      </div>
                    </>) : (<p className={`font-style-italic color-gray`}>{t("components:query_builder.no_variables_found")}</p>)}
                </fieldset>

              </>
            )}
          </FormWrapper>
          <output>
            {/* TODO: style this better */}
            {tableContent && tableContent.data.length > 0 ? (
              <div className="padding-inline-100">
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
                      tableContent.data.map((row, index) => {
                        // Find the column of the time value
                        let timeColumnIndex = 0;
                        tableContent.columns.map((column, index) => {
                          if (column.type == "t") timeColumnIndex = index
                        })
                        return (
                          index < 5 &&
                          <tr key={row.key[timeColumnIndex].value}>
                            <td>{row.key[timeColumnIndex].value}</td>
                            <td>{row.values[0]}</td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            ) :
              !defaultMetricSelected &&
              formRef.current?.checkValidity() && (
                <p className="padding-100">{t("components:query_builder.no_result_found")}</p>
              )
            }
          </output>
          {/* TODO: Should probably only be displayed on last slide? */}
          <button
            id="submit-button"
            disabled={true}
            type="submit"
            className="display-none seagreen color-purewhite margin-inline-auto block"
            style={{ width: "calc(100% - 2rem)" }}>{t("components:query_builder.add_data_source_button")}
          </button>

        </form>
      </dialog>
    </>
  )
}