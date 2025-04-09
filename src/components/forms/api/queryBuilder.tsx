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
import Image from "next/image";
import { FormEvent, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";

export default function QueryBuilder({
  goal,
}: {
  goal: Goal,
}) {
  const { t } = useTranslation();
  // Locale has the format language-locale, e.g. "sv-SE" or "en-US"
  // We only need the language part, so we split it and take the first part
  // TODO: Fix typing, use match() instead of casting
  const lang = useContext(LocaleContext).split("-")[0] as "sv" | "en";

  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>("");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const tableSearchInputName = "tableSearch";

  useEffect(() => {
    if (!dataSource) return;
    setIsLoading(true);
    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getTables(dataSource, query, lang).then(result => { setTables(result); setIsLoading(false); });
  }, [dataSource, lang]);

  function buildQuery(formData: FormData) {
    const queryObject: object[] = [];
    formData.forEach((value, key) => {
      // Skip empty values
      if (!value) return;
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

    return queryObject as { variableCode: string, valueCodes: string[] }[];
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
      externalSelection: query,
      timestamp: Date.now(),
    }), "PUT", setIsLoading);
  }

  function enableSubmitButton() {
    const submitButton = document.getElementById("submit-button");
    if (submitButton) {
      submitButton.removeAttribute("disabled");
      if (submitButton.classList.contains("hidden")) submitButton.classList.remove("hidden");
      if (submitButton.classList.contains("height-0")) submitButton.classList.remove("height-0");
      if (submitButton.classList.contains("padding-0")) submitButton.classList.remove("padding-0");
    }
  }

  function disableSubmitButton() {
    const submitButton = document.getElementById("submit-button");
    if (submitButton) {
      submitButton.setAttribute("disabled", "true");
      if (!submitButton.classList.contains("hidden")) submitButton.classList.add("hidden");
      if (!submitButton.classList.contains("height-0")) submitButton.classList.add("height-0");
      if (!submitButton.classList.contains("padding-0")) submitButton.classList.add("padding-0");
    }
  }

  function tryGetResult(event?: React.ChangeEvent<HTMLSelectElement> | FormEvent<HTMLFormElement> | Event) {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData); // This line is called before the form is cleared TODO - is this comment still relevant?
      const tableId = formData.get("externalTableId") as string ?? "";
      getTableContent(tableId, dataSource, query, lang).then(result => {
        setTableContent(result);
        if (result.data.length > 0) {
          enableSubmitButton();
        } else {
          disableSubmitButton();
        }
      });
      if (dataSource == "Trafa") {
        // If metric was changed, only send the metric as a query to the API
        if (event?.target instanceof HTMLSelectElement && event?.target.name == "metric") {
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
    }
  }
  function formChange(event: React.ChangeEvent<HTMLSelectElement> | FormEvent<HTMLFormElement> | Event) {
    const changedElementIsExternalDataset = event.target instanceof HTMLSelectElement && (event.target as HTMLSelectElement).name == "externalDataset";
    const changedElementIsTableSearch = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "tableSearch";
    const changedElementIsTable = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "externalTableId";

    console.log(tableDetails);
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
    console.time("tableSelect");
    if (!externalDatasets[dataSource]?.baseUrl) return;
    if (!tableId) return;
    setIsLoading(true);
    clearTableContent();
    clearTableDetails();
    disableSubmitButton();

    getTableDetails(tableId, dataSource, undefined, lang).then(result => { setTableDetails(result); console.timeEnd("tableSelect"); setIsLoading(false); });
  }

  function handleMetricSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    setIsLoading(true);
    const isDefaultValue = event.target.value.length == 0;
    const variableSelectionFieldsets = document.getElementsByName("variableSelectionFieldset");

    if (variableSelectionFieldsets.length > 0) {
      variableSelectionFieldsets.forEach(variableSelectionFieldset => {
        if (!isDefaultValue && variableSelectionFieldset.hasAttribute("disabled")) {
          variableSelectionFieldset.removeAttribute("disabled");
          // TODO - should trafa table details be fetched here? - no it is already fetched when the form is changed
        }
        else if (isDefaultValue) {
          // Reset the selection of all select elements in the variable fieldset before disabling
          variableSelectionFieldset.querySelectorAll("select").forEach(select => {
            select.value = "";
          });
          variableSelectionFieldset.setAttribute("disabled", "true");
          // Reset all the table details when disabling the form so all options are displayed when re-enabling
          if (dataSource == "Trafa") {
            getTableDetails(tableDetails?.id ?? "", dataSource, undefined, lang).then(result => { setTableDetails(result); });
          }
        }
      });
    } else {
      console.log("no variable selection fieldset found");
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 0);
  }

  // TODO: Take a look at this; should it really be an <a> element? Also translate.
  function optionalTag(dataSource: string, variableIsOptional: boolean) {
    if (getDatasetKeysOfApis("PxWeb").includes(dataSource) && variableIsOptional) return <a className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</a>;
  }

  function variableSelectionHelper(variable: TrafaVariable | PxWebVariable, tableDetails: ApiTableDetails) {
    if (variable.option) {
      return (
        <label key={variable.name} className="block margin-block-75">
          {// Only display "optional" tags if the data source provides this information
          }
          {variable.label[0].toUpperCase() + variable.label.slice(1)}{optionalTag(dataSource, variable.optional)}
          {// Use CSS to set proper capitalisation of labels; something like `label::first-letter { text-transform: capitalize; }`}
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
              <option value="" className={`${styles.defaultOption}`}>{t("components:query_builder.select_value")}</option>
            }
            {
              !getDatasetKeysOfApis("PxWeb").includes(dataSource) &&
              <option value="" className={`${styles.defaultOption}`}>{t("components:query_builder.select_value")}</option>
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

  function timeVariableSelectionHelper(times: (TrafaVariable | PxWebTimeVariable)[], language: string) {
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
          <option value="" className={`${styles.defaultOption}`}>{defaultValue}</option>
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
      <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={() => openModal(modalRef)}>
        {t("components:query_builder.add_historical_data")}
        <Image src="/icons/chartAdd.svg" alt="" width={16} height={16} />
      </button>
      <dialog className={`smooth${styles.dialog}`} ref={modalRef} aria-modal style={{ border: "0", boxShadow: "0 0 .5rem -.25rem rgba(0,0,0,.25" }}>
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between`}>
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label={t("common:tsx.close")} >
            <Image src="/icons/close.svg" alt="" width={18} height={18} />
          </button>
          <h2 className="margin-0">{t("components:query_builder.add_data_source")}</h2>
        </div>
        <p>{t("components:query_builder.add_data_to_goal", { goalName: goal.name ?? goal.indicatorParameter })}</p>

        <form ref={formRef} onChange={formChange} onSubmit={handleSubmit}>
          {/* Hidden disabled submit button to prevent accidental submisson */}
          <button type="submit" className="display-none" disabled></button>
          {isLoading &&
            <strong className="position-absolute gray-80 padding-100 rounded" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 100, opacity: "0.75" }}>{t("components:query_builder.loading")}</strong>
          }

          <FormWrapper>
            <fieldset>
              <label className="margin-block-75">
                {t("components:query_builder.data_source")}
                <div className="flex align-items-center gap-25">
                  <select className="block margin-block-25" required name="externalDataset" id="externalDataset" onChange={e => { handleDataSourceSelect(e.target.value) }}>
                    <option value="" className={`${styles.defaultOption}`}>{t("components:query_builder.select_source")}</option>
                    {Object.keys(externalDatasets).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {// Display warning message if the selected language is not supported by the api
                    (
                      (externalDatasets[dataSource])
                      &&
                      !(externalDatasets[dataSource]?.supportedLanguages.includes(lang))
                    )
                    &&
                    <span className="margin-left-50" style={{ fontSize: ".8rem", marginLeft: ".5rem", color: "red" }}>{t("components:query_builder.language_support_warning", { dataSource: dataSource })}</span>
                  }
                </div>
              </label>

              {// TODO: Check that this works well with dynamic keyboards (smartphone/tablet)
              }
              {dataSource ?
                <>
                  <div className="flex gap-25 align-items-flex-end margin-block-75">
                    <label className="flex-grow-100">
                      <span className="block margin-block-25">{t("components:query_builder.search_for_table")}</span>
                      <input name={tableSearchInputName} type="search" className="block" onKeyDown={searchOnEnter} />
                    </label>
                    <button type="button" onClick={searchWithButton} style={{ fontSize: "1rem" }}>{t("components:query_builder.search")}</button>
                  </div>

                  <div className="padding-25 smooth" style={{ border: "1px solid var(--gray-90)" }}>
                    <div className={styles.temporary}>
                      {tables && tables.map(({ tableId: id, label }) => (
                        <label id={`table${id}`} key={id} className={`${styles.tableSelect} block padding-block-25`}>
                          {label}
                          <input type="radio" value={id} name="externalTableId" onChange={e => handleTableSelect(e.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
                : null}
            </fieldset>

            {tableDetails && (
              // TODO - which inputs should be optional?
              <>
                <div className="block margin-block-75">
                  {t("components:query_builder.selected_table", { table: document.getElementById(`table${tableDetails.id}`)?.innerText })}
                </div>
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                  <legend className="padding-inline-50">
                    <strong>{t("components:query_builder.select_metric_for_table")}</strong>
                  </legend>
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
                </fieldset>
                <fieldset name="variableSelectionFieldset" disabled={true} className={`margin-block-100 smooth padding-50 fieldset-unset-pseudo-class`} style={{ border: `${shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? "1px solid var(--gray-90)" : ""}` }}>
                  {shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? (
                    <>
                      <legend className="padding-inline-50">
                        <strong>{t("components:query_builder.select_values_for_table")}</strong>
                      </legend>
                      {tableDetails.times &&
                        timeVariableSelectionHelper(tableDetails.times, tableDetails.language)
                      }
                      {tableDetails.variables.map(variable => {
                        return variableSelectionHelper(variable, tableDetails);
                      })}
                      {tableDetails.hierarchies && tableDetails.hierarchies.map(hierarchy => {
                        if (hierarchy.children?.some(variable => variable.option)) return (
                          <label key={hierarchy.name} className="block margin-block-75">
                            <strong>{hierarchy.label}</strong>
                            {// TODO - indent all children
                            }
                            {hierarchy.children && hierarchy.children.map(variable => {
                              return variableSelectionHelper(variable, tableDetails);
                            })}
                          </label>
                        )
                      })}
                    </>) : (<p className={`${styles.defaultOption}`}>{t("components:query_builder.no_variables_found")}</p>)}
                </fieldset>
              </>
            )}
          </FormWrapper>

          {tableContent && tableContent.data.length > 0 ? (
            <>
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
            </>
          ) : (
            <div>
              <p>{t("components:query_builder.no_result_found")}</p>
            </div>
          )}

          <button id="submit-button" disabled={true} type="submit" className="hidden seagreen color-purewhite">{t("components:query_builder.add_data_source_button")}</button>
        </form>
      </dialog>
    </>
  )
}