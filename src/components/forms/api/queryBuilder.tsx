"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import formSubmitter from "@/functions/formSubmitter";
import { ApiTableContent, ApiTableDetails, PxWebTimeVariable, PxWebVariable, TrafaVariable } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { externalDatasets, getDatasetKeysOfApis } from "@/lib/api/utility";
import { Goal } from "@prisma/client";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";

export default function QueryBuilder({
  goal,
}: {
  goal: Goal,
}) {
  const locale = "sv";

  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>("" as keyof keyof typeof externalDatasets);
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const tableSearchInputName = "tableSearch";

  useEffect(() => {
    if (!dataSource) return;

    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getTables(dataSource, query, locale).then(result => setTables(result));
  }, [dataSource, locale]);

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
    }
  }

  function disableSubmitButton() {
    const submitButton = document.getElementById("submit-button");
    if (submitButton) {
      submitButton.setAttribute("disabled", "true");
      if (!submitButton.classList.contains("hidden")) submitButton.classList.add("hidden");
    }
  }

  function tryGetResult() {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData); // This line is called before the form is cleared TODO - is this comment still relevant?
      const tableId = formData.get("externalTableId") as string ?? "";
      getTableContent(tableId, dataSource, query, locale).then(result => { setTableContent(result); });
      if (dataSource == "Trafa") {
        getTableDetails(tableId, dataSource, query, locale).then(result => { setTableDetails(result); });
      }
      enableSubmitButton();
    }
    // If not, make sure the submit button is disabled
    else disableSubmitButton(); clearTableContent();
  }
  function formChange(event: React.ChangeEvent<HTMLSelectElement> | FormEvent<HTMLFormElement> | Event) {
    const changedElementIsExternalDataset = event.target instanceof HTMLSelectElement && (event.target as HTMLSelectElement).name == "externalDataset";
    const changedElementIsTableSearch = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "tableSearch";
    const changedElementIsTable = event.target instanceof HTMLInputElement && (event.target as HTMLInputElement).name == "externalTableId";

    console.log(tableDetails);
    if (!changedElementIsExternalDataset && !changedElementIsTableSearch && !changedElementIsTable && tables && tableDetails) {
      tryGetResult();
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
    if (!externalDatasets[dataSource as keyof typeof externalDatasets].baseUrl) return;

    getTables(dataSource, query, locale).then(result => setTables(result));
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
    if (!externalDatasets[dataSource as keyof typeof externalDatasets].baseUrl) return;
    if (!tableId) return;
    clearTableContent();
    clearTableDetails();
    disableSubmitButton();

    getTableDetails(tableId, dataSource, undefined, locale).then(result => { setTableDetails(result); console.timeEnd("tableSelect"); });
  }

  function handleMetricSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const isDefaultValue = event.target.value.length == 0;
    const variableFieldset = document.getElementById("variable-fieldset");
    if (variableFieldset) {
      if (!isDefaultValue && variableFieldset.hasAttribute("disabled")) {
        variableFieldset.removeAttribute("disabled");
        // TODO - should trafa table details be fetched here?
      }
      else if (isDefaultValue) {
        // Reset the selection of all select elements in the variable fieldset before disabling
        variableFieldset.querySelectorAll("select").forEach(select => {
          select.value = "";
        });
        variableFieldset.setAttribute("disabled", "true");
        // Reset all the table details when disabling the form so all options are displayed when re-enabling
        if (dataSource == "Trafa") {
          getTableDetails(tableDetails?.id ?? "", dataSource, undefined, locale).then(result => { setTableDetails(result); });
        }
      }
    } else console.log("no variable fieldset found");
  }

  function variableSelectionHelper(variable: TrafaVariable | PxWebVariable, tableDetails: ApiTableDetails) {
    if (variable.option) return (
      <label key={variable.name} className="block margin-block-75">
        {variable.label[0].toUpperCase() + variable.label.slice(1)} {variable.optional && <i style={{ opacity: "50%" }}>- (valfri)</i>}
        {// Use CSS to set proper capitalisation of labels; something like `label::first-letter { text-transform: capitalize; }`}
        }
        <select className={`block margin-block-25 ${variable.label}`}
          required={!variable.optional}
          name={variable.name}
          id={variable.name}
          defaultValue={getDatasetKeysOfApis("PxWeb").includes(dataSource) ? (
            // If only one value is available, pre-select it
            variable.values && variable.values.length == 1 ? variable.values[0].label : undefined
          ) :
            undefined
          }>
          { // If only one value is available, don't show a placeholder option
            getDatasetKeysOfApis("PxWeb").includes(dataSource) && variable.values && variable.values.length > 1 &&
            <option value="" className={`${styles.defaultOption}`}>Välj ett värde</option>
          }
          {
            !getDatasetKeysOfApis("PxWeb").includes(dataSource) &&
            <option value="" className={`${styles.defaultOption}`}>Välj ett värde</option>
          }
          {variable.values && variable.values.map(value => (
            <option key={`${variable.name}-${value.name}`} value={value.name} lang={tableDetails.language}>{value.label}</option>
          ))}
        </select>
      </label>
    )
  }

  function timeVariableSelectionHelper(times: (TrafaVariable | PxWebTimeVariable)[], language: string) {
    if ((dataSource == "Trafa" && !(times.length == 1 && times[0].name == "ar")) || (getDatasetKeysOfApis("PxWeb").includes(dataSource) && times.length > 1)) {
      let heading = "";
      let defaultValue = "";
      let displayValueKey: keyof typeof times[0]/* "label" | "id" | "name" | "type" */ = "id"
      if (dataSource == "Trafa") {
        heading = "Välj tidsserie";
        defaultValue = "Välj tidsserie";
        displayValueKey = "label";
      } else if (getDatasetKeysOfApis("PxWeb").includes(dataSource)) {
        heading = "Välj startperiod";
        defaultValue = "Välj tidsperiod";
        displayValueKey = "id";
      }
      return (<label key="Tid" className="block margin-block-75">
      {heading}
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
    const returnBool = (tableDetails.hierarchies.length > 0 || (!getDatasetKeysOfApis("PxWeb").includes(dataSource) && tableDetails.variables.some(variable => variable.option)) || tableDetails.times.length > 1);
    return returnBool;
  }

  return (
    <>
      <button type="button" className="transparent flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={() => openModal(modalRef)}>
        Lägg till historisk data
        <Image src="/icons/chartAdd.svg" alt="" width={16} height={16} />
      </button>
      <dialog className={`smooth${styles.dialog}`} ref={modalRef} aria-modal style={{ border: "0", boxShadow: "0 0 .5rem -.25rem rgba(0,0,0,.25" }}>
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between`}>
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label="Close" >
            <Image src="/icons/close.svg" alt="" width={18} height={18} />
          </button>
          <h2 className="margin-0">Lägg till datakälla</h2>
        </div>
        <p>Lägg till historisk dataserie till {goal.name ?? goal.indicatorParameter}</p>

        <form ref={formRef} onChange={formChange} onSubmit={handleSubmit}>
          {/* Hidden disabled submit button to prevent accidental submisson */}
          <button type="submit" className="display-none" disabled></button>

          <FormWrapper>
            <fieldset>
              <label className="margin-block-75">
                Datakälla
                <select className="block margin-block-25" required name="externalDataset" id="externalDataset" onChange={e => { handleDataSourceSelect(e.target.value) }}>
                  <option value="" className={`${styles.defaultOption}`}>Välj en källa</option>
                  {Object.keys(externalDatasets).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {// Display warning message if the selected language is not supported by the api
                  (
                    (externalDatasets[dataSource as keyof typeof externalDatasets])
                    &&
                    !(externalDatasets[dataSource as keyof typeof externalDatasets].supportedLanguages.includes(locale))
                  )
                  &&
                  <p style={{ color: "red" }}>{dataSource} stödjer inte ditt valda språk. Ett tillgängligt språk kommer att användas istället.</p>
                }
              </label>

              {// TODO: Check that this works well with dynamic keyboards (smartphone/tablet)
              }
              {dataSource ?
                <>
                  <div className="flex gap-25 align-items-flex-end margin-block-75">
                    <label className="flex-grow-100">
                      <span className="block margin-block-25">Sök efter tabell</span>
                      <input name={tableSearchInputName} type="search" className="block" onKeyDown={searchOnEnter} />
                    </label>
                    <button type="button" onClick={searchWithButton} style={{ fontSize: "1rem" }}>Sök</button>
                  </div>

                  <div className="padding-25 smooth" style={{ border: "1px solid var(--gray-90)" }}>
                    <div className={styles.temporary}>
                      {tables && tables.map(({ tableId: id, label }) => (
                        <label key={id} className={`${styles.tableSelect} block padding-block-25`}>
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
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                  <legend className="padding-inline-50">
                    <strong>Välj mätvärde för tabellen</strong>
                  </legend>
                  <label key={`metric-${tableDetails.id}`} className="block margin-block-75">
                    <select className={`block margin-block-25 metric`}
                      required={true}
                      name="metric"
                      id="metric"
                      defaultValue={undefined}
                      onChange={handleMetricSelect}>
                      <option value="" className={`${styles.defaultOption}`}>Välj ett mätvärde</option>
                      {tableDetails.metrics && tableDetails.metrics.map(metric => (
                        <option key={metric.name} value={metric.name} lang={tableDetails.language}>{metric.label}</option>
                      ))}
                    </select>


                  </label>
                </fieldset>
                <fieldset id="variable-fieldset" disabled={true} className={`margin-block-100 smooth padding-50`} style={{ border: `${shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? "1px solid var(--gray-90)" : ""}` }}>
                  {shouldVariableFieldsetBeVisible(tableDetails, dataSource) ? (
                    <>
                      <legend className="padding-inline-50">
                        <strong>Välj värden för tabell</strong>
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
                    </>) : (<p className={`${styles.defaultOption}`}>Det finns inga variabler</p>)}
                </fieldset>
              </>
            )}
          </FormWrapper>

          {tableContent ? (
            <div>
              <p>Ser detta rimligt ut? (visar max 5 värden)</p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col">Värde</th>
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
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <p>Inget läsbart resultat hittades. Vänligen uppdatera dina val.</p>
            </div>
          )}

          <button id="submit-button" disabled={true} type="submit" className="hidden seagreen color-purewhite">Lägg till datakälla</button>
        </form>
      </dialog>
    </>
  )
}