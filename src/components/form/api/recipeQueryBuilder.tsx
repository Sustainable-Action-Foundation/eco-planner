"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import type { ApiMetadataDimensionBase, ApiTableContent, ApiTableMetadata } from "@/lib/api/apiTypes";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { ExternalDataset, formQueryHelper, isDataSetKeys } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { PxWebCompatTimeDimension } from "@/lib/api/pxWeb/pxWebApiV2Types";
import type { TrafaCompatTimeDimension } from "@/lib/api/trafa/trafaTypes";
import { useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";
import { IconDatabaseSearch, IconSearch, IconX } from "@tabler/icons-react";
import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import getTableContent from "@/lib/api/getTableContent";
import { RecipeDataTypes } from "@/functions/recipe";

export default function RecipeQueryBuilder({
  variableId,
  initialDataSource,
  initialTableId,
  initialSelection,
}: {
  variableId: string;
  initialDataSource?: string;
  initialTableId?: string;
  initialSelection?: { variableCode: string, valueCodes: string[] }[];
}) {
  const { t } = useTranslation("components");
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;
  const { upsertVariable } = useRecipe();

  function getInitialSelectionValue(variableCode: string) {
    const valueCode = initialSelection?.find(selection => selection.variableCode === variableCode)?.valueCodes?.[0];
    if (!valueCode) return undefined;

    const fromMatch = /^FROM\((.+)\)$/i.exec(valueCode);
    return fromMatch?.[1] ?? valueCode;
  }

  const [isLoading, setIsLoading] = useState(Boolean(initialDataSource));
  const [dataSource, setDataSource] = useState<string>(initialDataSource ?? "");
  const [selectedTableId, setSelectedTableId] = useState<string>(initialTableId ?? "");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [tableDetails, setTableDetails] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [defaultMetricSelected, setDefaultMetricSelected] = useState(true);
  const hasAppliedInitialTableSelectionRef = useRef(false);
  const hasAppliedInitialSelectionRef = useRef(false);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const selectorMenuRef = useRef<HTMLDivElement | null>(null);

  const tableSearchInputName = "tableSearch";

  // These variables determine how many tables are rendered at a time, and how many are rendered when the user scrolls down/up
  // The first number is the amount of tables that are rendered when the user scrolls down/up, and the second number is the maximum amount of tables that are rendered at once.
  // The initial rendering margin allows for more than the maximum amount of tables to be rendered at once if the total amount of tables is less than the maximum amount of tables plus the margin (currently adding to 115).
  const tablesListRenderingChunkSize = 50;
  const renderedTablesListMaxLength = 100;
  const initialRenderingMargin = 15;
  const shouldRenderAllTables = (tables?.length ?? 0) <= renderedTablesListMaxLength + initialRenderingMargin;
  const renderedTables = tables
    ? tables.slice(
      shouldRenderAllTables ? 0 : offset,
      shouldRenderAllTables ? tables.length : offset + renderedTablesListMaxLength,
    )
    : null;

  // Get tables when source or language changes.
  useEffect(() => {
    if (!dataSource) return;

    const query = (fieldsetRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getTables(dataSource, query, lang)
      .then(result => { setTables(result); setOffset(0); })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error fetching tables:", errorMessage);
        setTables(null);
      })
      .finally(() => setIsLoading(false));
  }, [dataSource, lang]);

  // If we got an initial table, load its details.
  useEffect(() => {
    if (!dataSource || !initialTableId || hasAppliedInitialTableSelectionRef.current) return;
    if (!tables?.some(table => table.tableId === initialTableId)) return;
    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;

    hasAppliedInitialTableSelectionRef.current = true;
    getTableMetadata(initialTableId, dataSource, undefined, lang)
      .then(result => { setTableDetails(result); })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error fetching initial table details:", errorMessage);
        setTableDetails(null);
      })
      .finally(() => setIsLoading(false));
  }, [dataSource, initialTableId, lang, tables]);

  // Run one first query when initial values are set.
  useEffect(() => {
    if (!tableDetails || !initialSelection?.length || hasAppliedInitialSelectionRef.current) return;
    if (!(selectorMenuRef.current instanceof HTMLDivElement)) return;

    const metricSelect = selectorMenuRef.current.querySelector("#metric");
    if (!(metricSelect instanceof HTMLSelectElement)) return;
    if (!metricSelect.value) return;

    hasAppliedInitialSelectionRef.current = true;
    metricSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, [initialSelection, tableDetails]);

  // Show or hide the loader.
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

  function searchOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      handleSearch((event.target as HTMLInputElement).value);
    }
  }

  function searchWithButton() {
    const query = (fieldsetRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;
    handleSearch(query ?? undefined);
  }

  function handleSearch(query?: string) {
    if (!dataSource || !ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;

    setIsLoading(true);
    getTables(dataSource, query, lang)
      .then(result => { setTables(result); setOffset(0); })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error fetching tables:", errorMessage);
        setTables(null);
      })
      .finally(() => setIsLoading(false));
  }

  function handleDataSourceSelect(dataSource: string) {
    setIsLoading(true);
    setDataSource(dataSource);
    setSelectedTableId("");
    setDefaultMetricSelected(true);
    setOffset(0);
    hasAppliedInitialTableSelectionRef.current = false;
    hasAppliedInitialSelectionRef.current = false;
    // Clear table details and content whenever the data source changes
    setTableContent(null);
    setTableDetails(null);
    // Make sure submit button is disabled when the data source is changed
  }

  function handleTableSelect(tableId: string) {
    setIsLoading(true);
    setSelectedTableId(tableId);
    setDefaultMetricSelected(true);
    hasAppliedInitialSelectionRef.current = false;

    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;
    if (!tableId) return;

    setTableContent(null);
    setTableDetails(null);

    getTableMetadata(tableId, dataSource, undefined, lang)
      .then(result => { setTableDetails(result); })
      .catch((e: unknown) => {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Error fetching table details:", errorMessage);
        setTableDetails(null);
      })
      .finally(() => setIsLoading(false));
  }

  function handleMetricSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    tryGetResult();
    setIsLoading(true);
    const isDefaultValue = event.target.value.length === 0;
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
          if (dataSource === "Trafa") {
            getTableMetadata(tableDetails?.tableId ?? "", dataSource, undefined, lang)
              .then(result => { setTableDetails(result); })
              .catch((e: unknown) => {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error("Error resetting table details:", errorMessage);
              })
              .finally(() => setIsLoading(false));
          }
          else {
            setIsLoading(false);
          }
        }
      });
    }
    else {
      setIsLoading(false);
    }
  }

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean) {
    if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && variableIsOptional) return <span className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</span>;
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
        setOffset(newOffset);
      }
    }
  }

  function variableSelectionHelper(dimension: ApiMetadataDimensionBase, tableDetails: ApiTableMetadata, options?: { classNames?: string[], }) {
    if (dimension.options) {
      return (
        <label key={dimension.name} className={`block margin-block-75 ${options?.classNames?.map((className: string) => className).join(" ")}`}>
          {/* Only display "optional" tags if the data source provides this information */}
          <span style={{ "textTransform": "capitalize" }}>
            {dimension.label ?? dimension.name}{optionalTag(dataSource, dimension.optional ?? false)}
          </span>
          {/* TODO: Use CSS to set proper capitalization of labels; something like `label::first-letter { text-transform: capitalize; }` */}
          <select
            onChange={tryGetResult}
            className={`block margin-block-25 ${dimension.label}`}
            required={!dimension.optional}
            name={dimension.name}
            id={dimension.name}
            defaultValue={
              getInitialSelectionValue(dimension.name)
              ??
              (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" ?
                (// If only one value is available, pre-select it
                  dimension.options?.length === 1 ? dimension.options[0].value : undefined
                )
                :
                undefined
              )
            }>
            { // If only one value is available, don't show a placeholder option
              // Why is this only done for PxWeb?
              ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && dimension.options.length > 1 ? <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option> : null
            }
            {
              !(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") &&
              <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option>
            }
            {dimension.options?.map(({ label, value }) => (
              <option key={`${dimension.name}-${value}`} value={value} lang={tableDetails.language}>{label ?? value}</option>
            ))}
          </select>
        </label>
      );
    }
  }

  function timeVariableSelectionHelper(times: (TrafaCompatTimeDimension | PxWebCompatTimeDimension)[], language?: string) {
    return times.map((time, i) => {
      let heading = "";
      let defaultValue = "";
      if (dataSource === "Trafa") {
        // heading = "Välj tidsintervall";
        heading = t("components:query_builder.select_time_interval");
        // defaultValue = "Välj tidsintervall";
        defaultValue = t("components:query_builder.select_time_interval");
      } else if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") {
        // heading = "Välj startperiod";
        heading = t("components:query_builder.select_starting_period");
        // defaultValue = "Välj tidsperiod";
        defaultValue = t("components:query_builder.select_time_period");
      }
      return (
        <label key={`Tid-${i}`} className="block margin-block-75">
          {heading}{optionalTag(dataSource, time.optional ?? false)}
          <select
            onChange={tryGetResult}
            className={`block margin-block-25 TimeVariable`}
            required={!time.optional}
            name={time.id}
            id={time.id}
            defaultValue={getInitialSelectionValue(time.id) ?? (time.options.length === 1 ? times[0].name : "")}>
            <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
            {time.options.map(({ value, label }) => (
              <option key={`Tid-${i}-${label ?? value}`} value={value} lang={language}>{label ?? value}</option>
            ))}
          </select>
        </label>
      );
    });
  }

  function shouldVariableFieldsetBeVisible(tableDetails: ApiTableMetadata, dataSource: string) {
    const returnBool = ((tableDetails.hierarchies && tableDetails.hierarchies.length > 0) || (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb")) || tableDetails.timeDimensions.length > 1);
    return returnBool;
  }

  function tryGetResult(event?: React.ChangeEvent<HTMLSelectElement> | Event) {
    // null check
    if (!(selectorMenuRef.current instanceof HTMLDivElement)) return;

    setIsLoading(true);

    // Get a result if the form is valid
    const formElements = selectorMenuRef.current.querySelectorAll("select");
    const formData = new FormData();
    formElements.forEach(element => {
      formData.append(element.name, element.value);
    });

    const query = formQueryHelper(formData, [tableSearchInputName] /* TODO: include any PxWeb main time variable */);
    const tableId = tableDetails?.tableId ?? formData.get("externalTableId") as string ?? "";
    getTableContent(tableId, dataSource, query, lang).then(result => {
      setTableContent(result);
      setIsLoading(false);
    }).catch((e: unknown) => {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Error fetching table content:", errorMessage);
      setTableContent(null);
      setIsLoading(false);
    });
    if (dataSource === "Trafa") {
      // If metric was changed, send the metric as a query to the API to get filtered table details
      if (event?.target instanceof HTMLSelectElement && event.target.name === "metric") {
        getTableMetadata(tableId, dataSource, query.filter(q => q.variableCode === "metric"), lang)
          .then(result => { setTableDetails(result); })
          .catch((e: unknown) => {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error("Error fetching metric-filtered table details:", errorMessage);
          });
      }
    }
  }

  function saveRecipe() {
    // null check
    if (!(selectorMenuRef.current instanceof HTMLDivElement)) return;

    setIsLoading(true);

    const formElements = selectorMenuRef.current.querySelectorAll("select");
    const formData = new FormData();
    formElements.forEach(element => {
      formData.append(element.name, element.value);
    });

    const query = formQueryHelper(formData, [tableSearchInputName] /* TODO: include any PxWeb main time variable */);

    upsertVariable(variableId, prev => prev.type === RecipeDataTypes.External
      ? {
        ...prev,
        dataset: isDataSetKeys(dataSource) ? dataSource : prev.dataset,
        tableId: tableDetails?.tableId ?? formData.get("externalTableId") as string ?? prev.tableId,
        selection: query,
      }
      : prev,
    );
    closeModal(modalRef);
  }

  return (
    <>
      <button
        type="button"
        className="purewhite flex justify-content-space-between align-items-center gap-25 padding-50 font-size-14px width-100"
        style={{ border: '1px solid var(--gray-80)', transform: 'scale(1)', color: dataSource && tableDetails?.tableId && tableContent?.metadata[0].label ? 'black' : 'gray' }}
        onClick={() => openModal(modalRef)}
      // TODO: This needs a title in case of overflow...
      >
        <span className="white-space-nowrap">
          {dataSource && tableDetails?.tableId
            ? `${dataSource}(${tableDetails.tableId}) - `
            : t("components:recipe_editor.add_external_data")
          }
        </span>
        {dataSource && tableDetails?.tableId ? <span
          className="flex-grow-100 align-self-flex-end text-align-left white-space-nowrap width-0 text-overflow-ellipsis overflow-hidden" // I can never figure out flex, honestly not sure why width-0 works here... 
          style={{ borderBottom: tableContent?.metadata[0].label ? '' : '1px solid gray' }} // TODO: Should just be if any label, not specifically [0]...
        >
          {tableContent?.metadata?.length
            ? tableContent.metadata
              .map(item => item.label)
              .filter(Boolean)
              .join(", ")
            : ""}
        </span> : null}
        <IconDatabaseSearch strokeWidth={1.75} width={20} height={20} color='black' style={{ minWidth: '20' }} aria-hidden="true" />
      </button>

      <dialog className={`rounded padding-inline-0 padding-block-0 ${styles.dialog}`} ref={modalRef} aria-modal={true} style={{ backgroundColor: 'rgb(246, 246, 246)' }}>
        <div className={`${styles['dialog-content']}`}>
          <div className={`${styles['dialog-header']}`}>
            <button type="button" className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus={true} aria-label={t("common:tsx.close")} >
              <IconX strokeWidth={3} width={28} height={28} style={{ minWidth: '28px' }} aria-hidden="true" />
            </button>
            <h2 className="margin-0">{t("components:query_builder.add_data_source")}</h2>
          </div>

          <div className={`${styles['dialog-body']}`}>
            <FormWrapper>
              <fieldset className="position-relative" ref={fieldsetRef}>
                <label className="margin-block-75 font-weight-500">
                  {t("components:query_builder.data_source")}
                  {/* Display warning message if the selected language is not supported by the api */}
                  {((ExternalDataset.getDatasetByAlternateName(dataSource)) && !(ExternalDataset.getDatasetByAlternateName(dataSource)?.supportedLanguages.includes(lang))) ?
                    <small className="font-weight-normal font-style-italic margin-left-50" style={{ color: "red" }}>{t("components:query_builder.language_support_warning", { dataSource: dataSource })}</small>
                    : null}
                  <select className="block margin-block-25 width-100" required={true} name="externalDataset" id="externalDataset" value={dataSource} onChange={(e) => { handleDataSourceSelect(e.target.value); }}>
                    <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_source")}</option>
                    {ExternalDataset.knownDatasetKeys.map((name) => (
                      <option key={name} value={name}>{ExternalDataset[name]?.fullName}</option>
                    ))}
                  </select>
                </label>

                {dataSource ?
                  <>
                    <div className="margin-top-100 margin-bottom-25">
                      {/* TODO: Label currently affects multiple elements, fix this */}
                      <label className="font-weight-500">
                        {t("components:query_builder.search_for_table")}
                        <div className="focusable purewhite flex align-items-center margin-top-25 padding-left-50 smooth">
                          <IconSearch strokeWidth={1.5} style={{ minWidth: '24px' }} aria-hidden="true" />
                          <input name={tableSearchInputName} type="search" className="padding-0 margin-inline-50 flex-grow-100" onKeyDown={searchOnEnter} style={{ backgroundColor: "transparent" }} />
                          <button type="button" onClick={searchWithButton} className="padding-block-50 padding-inline-100 transparent font-weight-500">{t("components:query_builder.search")}</button> {/* TODO: this does not work */}
                        </div>
                      </label>
                    </div>

                    <ul
                      id="tablesList"
                      className={`position-relative padding-25 smooth purewhite ${styles.temporary}`} onScroll={e => handleTableListScroll(e)}
                      style={{ maxHeight: "300px", border: "1px solid var(--gray-80)", listStyle: "none", overflowY: 'scroll' }} >
                      {renderedTables?.map(({ tableId: id, label }) => (
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
                            checked={selectedTableId === id}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              handleTableSelect((e.target as HTMLInputElement).value);
                              upsertVariable(variableId, prev => prev.type === RecipeDataTypes.External
                                ? { ...prev, tableId: e.target.value }
                                : prev,
                              );
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                  : null}

              </fieldset>

              {tableDetails ? <div ref={selectorMenuRef}>
                <label className="block margin-block-75">
                  <Trans
                    i18nKey={"components:query_builder.selected_table"}
                    values={{ table: document.getElementById(`table${tableDetails.tableId}`)?.innerText }}
                    components={{ strong: <strong />, small: <small />, i: <i /> }}
                  />
                  {/* {t("components:query_builder.selected_table", { table: document.getElementById(`table${tableDetails.id}`)?.innerText })} */}
                </label>
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                  <legend className="padding-inline-50">
                    <b>{t("components:query_builder.select_metric_for_table")}</b>
                  </legend>
                  <div>
                    <label key={`metric-${tableDetails.tableId}`} className="block margin-block-75">
                      <select
                        className={`block margin-block-25 metric`}
                        required={true}
                        name="metric"
                        id="metric"
                        defaultValue={getInitialSelectionValue("metric")}
                        onChange={handleMetricSelect}>
                        <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_metric")}</option>
                        {tableDetails.metricDimensions?.map(metric => (
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
                        {tableDetails.timeDimensions ? timeVariableSelectionHelper(tableDetails.timeDimensions, tableDetails.language) : null
                        }
                        {tableDetails.regularDimensions.map(variable => {
                          return variableSelectionHelper(variable, tableDetails);
                        })}
                        {tableDetails.hierarchies?.map(hierarchy => {
                          return (
                            <label key={hierarchy.name} className="block margin-block-75">
                              <b>{hierarchy.label}</b>
                              {hierarchy.children?.map(variable => {
                                return variableSelectionHelper(variable, tableDetails, { classNames: ["margin-left-75"] });
                              })}
                            </label>
                          );
                        })}
                      </div>
                    </>) : (<p className={`font-style-italic color-gray`}>{t("components:query_builder.no_variables_found")}</p>)}
                </fieldset>

              </div> : null}
            </FormWrapper>
            <output className="block padding-bottom-100">
              {/* TODO: style this better */}
              {tableContent && tableContent.values.length > 0 ? (
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
                !defaultMetricSelected &&
                (
                  <p className="padding-100">{t("components:query_builder.no_result_found")}</p>
                )
              }
            </output>
            {/* TODO: Should probably only be displayed on last slide? */}
            <button
              id="submit-button"
              type="button"
              className="seagreen color-purewhite block width-100"
              onClick={() => saveRecipe()}
            >
              {t("components:query_builder.add_data_source_button")}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}