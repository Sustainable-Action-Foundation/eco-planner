"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import formSubmitter from "@/functions/formSubmitter";
import { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableDetails from "@/lib/api/getTableDetails";
import getTables from "@/lib/api/getTables";
import { externalDatasets, getDatasetKeysOfApis } from "@/lib/api/utility";
import { PxWebTimeVariable, PxWebVariable } from "@/lib/pxWeb/pxWebApiV2Types";
import { TrafaVariable } from "@/lib/trafa/trafaTypes";
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
  const [dataSource, setDataSource] = useState<string>("");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [renderedTables, setRenderedTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const tableSearchInputName = "tableSearch";

  // TODO - comment
  const tablesListRenderingChunkSize = 50;
  const renderedTablesListMaxLength = 100;
  const initialRenderingMargin = 15;

  useEffect(() => {
    if (!dataSource) return;
    setIsLoading(true);
    console.time("getTables");
    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getTables(dataSource, query, locale).then(result => { setTables(result); setIsLoading(false); console.timeEnd("getTables"); });
  }, [dataSource, locale]);

  useEffect(() => {
    if (tables) {
      // TODO - comment
      setRenderedTables(tables.slice(0, tables.length < renderedTablesListMaxLength + initialRenderingMargin ? renderedTablesListMaxLength + initialRenderingMargin : renderedTablesListMaxLength > tables.length ? renderedTablesListMaxLength : tablesListRenderingChunkSize));
      setOffset(0);
    } else {
      setRenderedTables(null);
      setOffset(0);
    }
  }, [tables]);

  useEffect(() => {
    const loadingText = document.getElementById("loader");
    if (isLoading && loadingText) {
      loadingText.classList.remove("hidden");
    } else if (!isLoading && loadingText) {
      setTimeout(() => {
        loadingText.classList.add("hidden");
      }, 0);
    }
  }, [isLoading]);

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
      if (submitButton.classList.contains("display-none")) submitButton.classList.remove("display-none");
      if (submitButton.classList.contains("height-0")) submitButton.classList.remove("height-0");
      if (submitButton.classList.contains("padding-0")) submitButton.classList.remove("padding-0");
    }
  }

  function disableSubmitButton() {
    const submitButton = document.getElementById("submit-button");
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

    console.time("tryGetResult");

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData); // This line is called before the form is cleared TODO - is this comment still relevant?
      const tableId = tableDetails?.id ?? formData.get("externalTableId") as string ?? "";

      getTableContent(tableId, dataSource, query, locale).then(result => {
        setTableContent(result);
        if (result.data.length > 0) {
          enableSubmitButton();
        } else {
          disableSubmitButton();
        }
        console.timeEnd("tryGetResult");
      });
      if (dataSource == "Trafa") {
        // If metric was changed, only send the metric as a query to the API
        if (event?.target instanceof HTMLSelectElement && event.target.name == "metric") {
          getTableDetails(tableId, dataSource, query.filter(q => q.variableCode == "metric"), locale).then(result => { setTableDetails(result); });
        } else {
          getTableDetails(tableId, dataSource, query, locale).then(result => { setTableDetails(result); });
        }
      }
    }
    // If not, make sure the submit button is disabled
    else {
      disableSubmitButton();
      clearTableContent();
      console.timeEnd("tryGetResult");
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
    if (!externalDatasets[dataSource]?.baseUrl) return;
    if (!tableId) return;
    setIsLoading(true);
    clearTableContent();
    clearTableDetails();
    disableSubmitButton();

    const selectedTables = document.getElementsByClassName(styles.selectedTable);
    for (let i = 0; i < selectedTables.length; i++) {
      selectedTables[i].classList.remove(styles.selectedTable);
    }

    const selectedTable = document.getElementById(`table${tableId}`);
    if (selectedTable) {
      selectedTable.classList.add(styles.selectedTable)
    }

    getTableDetails(tableId, dataSource, undefined, locale).then(result => { setTableDetails(result); console.timeEnd("tableSelect"); setIsLoading(false); });
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
            getTableDetails(tableDetails?.id ?? "", dataSource, undefined, locale).then(result => { setTableDetails(result); });
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

  function optionalTag(dataSource: string, variableIsOptional: boolean) {
    if (getDatasetKeysOfApis("PxWeb").includes(dataSource) && variableIsOptional) return <a className={`font-style-italic color-gray`}> - (valfri)</a>;
  }

  function handleTableListScroll(event: React.UIEvent<HTMLUListElement, UIEvent>) {
    if (event.target && event.target instanceof HTMLElement && tables && event.target.children.length < tables.length) {
      // TODO - comment
      if (renderedTables && event.target.scrollTop + event.target.clientHeight * 2 >= event.target.scrollHeight && tables.findIndex(table => table.tableId == renderedTables[renderedTables.length - 1].tableId) < tables.length - 1) {
        const newOffset = renderedTables.length == renderedTablesListMaxLength ? offset + tablesListRenderingChunkSize : offset;
        const newRenderedTables = tables.slice(newOffset, newOffset + renderedTablesListMaxLength);
        setRenderedTables(newRenderedTables);
        setOffset(newOffset);
      }
      else if (event.target.scrollTop < event.target.clientHeight * 2 && offset > 0) {
        const newOffset = offset - tablesListRenderingChunkSize;
        const newRenderedTables = tables.slice(newOffset, newOffset + renderedTablesListMaxLength);
        setRenderedTables(newRenderedTables);
        setOffset(newOffset);
      }
    }
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
              <option value="" className={`font-style-italic color-gray`}>Välj ett värde</option>
            }
            {
              !getDatasetKeysOfApis("PxWeb").includes(dataSource) &&
              <option value="" className={`font-style-italic color-gray`}>Välj ett värde</option>
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
        heading = "Välj tidsintervall";
        defaultValue = "Välj tidsintervall";
        displayValueKey = "label";
      } else if (getDatasetKeysOfApis("PxWeb").includes(dataSource)) {
        heading = "Välj startperiod";
        defaultValue = "Välj tidsperiod";
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
      <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem" }} onClick={() => openModal(modalRef)}>
        Lägg till historisk data
        <Image src="/icons/chartAdd.svg" alt="" width={16} height={16} />
      </button>

      <dialog className={`smooth padding-inline-0 ${styles.dialog}`} ref={modalRef} aria-modal>
          <div className='display-flex flex-direction-row-reverse align-items-center justify-content-space-between padding-inline-100'>
            <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label="Close" >
              <Image src="/icons/close.svg" alt="" width={18} height={18} />
            </button>
            <h2 className="margin-0">Lägg till datakälla</h2>
          </div>

          <p className="padding-inline-100">Lägg till historisk dataserie till {goal.name ?? goal.indicatorParameter}</p>

          <form ref={formRef} onChange={formChange} onSubmit={handleSubmit}>
            {/* Hidden disabled submit button to prevent accidental submisson */}
            <button type="submit" className="display-none" disabled></button>

            <FormWrapper>
              <fieldset className="position-relative">
                <label className="margin-block-75 font-weight-500">
                  Datakälla
                  <select className="block margin-block-25 width-100" required name="externalDataset" id="externalDataset" onChange={e => { handleDataSourceSelect(e.target.value) }}>
                    <option value="" className='font-style-italic color-gray'>Välj en källa</option>
                    {Object.keys(externalDatasets).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>

                  {/* Display warning message if the selected language is not supported by the api */}
                  {((externalDatasets[dataSource]) && !(externalDatasets[dataSource]?.supportedLanguages.includes(locale))) ?
                    <p style={{ color: "red" }}>{dataSource} stödjer inte ditt valda språk. Ett tillgängligt språk kommer att användas istället.</p>
                  : null }
                </label>
 
                {dataSource ?
                  <>
                    <div className="margin-top-200 margin-bottom-25">
                      <label className="font-weight-500">
                        Sök efter tabell 
                        <div className="focusable gray-90 flex align-items-center margin-top-25 padding-left-50 smooth">
                          <Image alt="" loading="lazy" width="24" height="24" decoding="async" data-nimg="1" src="/icons/search.svg" />
                          <input name={tableSearchInputName} type="search" className="padding-0 margin-inline-50" onKeyDown={searchOnEnter} style={{backgroundColor: 'transparent'}} />
                          <button type="button" onClick={searchWithButton} className="padding-block-50 padding-inline-100 transparent font-weight-500">Sök</button>
                        </div>
                      </label>
                    </div>

                    <ul 
                      id="tablesList" 
                      className={`position-relative padding-25 smooth ${styles.temporary}`} onScroll={e => handleTableListScroll(e)} 
                      style={{ maxHeight: "300px", border: "1px solid var(--gray-90)", listStyle: 'none' }} >
                      <div 
                        id="loader" 
                        className={`position-absolute padding-100 smooth width-100 height-100 flex align-items-center justify-content-center font-weight-500 ${!isLoading && "hidden"}`} 
                        style={{backgroundColor: 'rgba(255,255,255,.75)', top: '0', left: '0'}}>
                          Laddar...
                      </div>
                      {renderedTables && renderedTables.map(({ tableId: id, label }) => (
                        <li key={id} >
                          <button 
                            type="button" 
                            className="block width-100 text-align-left font-weight-500 transparent"  
                            id={`table${id}`}
                            value={id}  
                            name="externalTableId" 
                            onClick={e => handleTableSelect((e.target as HTMLButtonElement).value)}>
                            {label}
                          </button>
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
                    <strong>Vald tabell:</strong> {document.getElementById(`table${tableDetails.id}`)?.innerText}
                  </label>
                  <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                    <legend className="padding-inline-50">
                      <b>Välj mätvärde för tabellen</b>
                    </legend>
                    <div>
                      <label key={`metric-${tableDetails.id}`} className="block margin-block-75">
                        <select className={`block margin-block-25 metric`}
                          required={true}
                          name="metric"
                          id="metric"
                          defaultValue={undefined}
                          onChange={handleMetricSelect}>
                          <option value="" className={`font-style-italic color-gray`}>Välj ett mätvärde</option>
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
                          <b>Välj värden för tabell</b>
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
                                {// TODO - indent all children
                                }
                                {hierarchy.children && hierarchy.children.map(variable => {
                                  return variableSelectionHelper(variable, tableDetails);
                                })}
                              </label>
                            )
                          })}
                        </div>
                      </>) : (<p className={`font-style-italic color-gray`}>Det finns inga variabler</p>)}
                  </fieldset>
                  <output>
                    {/* TODO: style this better */}
                    {tableContent && tableContent.data.length > 0 ? (
                      <div className="padding-inline-100">
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
                              })
                            }
                          </tbody>
                        </table>
                      </div>
                      ) : 
                      (document.getElementById("metric") as HTMLSelectElement) &&
                      (document.getElementById("metric") as HTMLSelectElement).value.length != 0 &&
                      (formRef.current instanceof HTMLFormElement) &&
                      formRef.current.checkValidity() && (
                        <p>Inget läsbart resultat hittades. Vänligen uppdatera dina val.</p>
                      )
                    }
                  </output>
                </>
              )}
            </FormWrapper>
          
            <button 
              id="submit-button" 
              disabled={true} 
              type="submit" 
              className="display-none seagreen color-purewhite margin-inline-auto block" 
              style={{width: 'calc(100% - 2rem)'}}>Lägg till datakälla
            </button>

          </form>
      </dialog>
    </>
  )
}