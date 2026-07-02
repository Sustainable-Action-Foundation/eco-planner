"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import formSubmitter from "@/functions/formSubmitter";
import type { ApiMetadataDimensionBase, ApiTableContent, ApiTableMetadata } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { ExternalDataset, formQueryHelper } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { Goal } from "@/lib/prisma/generated";
import type { ChangeEventHandler, SubmitEvent } from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";
import { IconChartHistogram, IconSearch, IconTrashXFilled, IconX } from "@tabler/icons-react";
import DataSeriesGrid from "@/components/recipe/input/dataSeriesGrid";

export default function QueryBuilder({
  goal,
}: {
  goal: Goal,
}) {
  const { t } = useTranslation(["components", "forms"]);
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;

  const [isLoading, setIsLoading] = useState(false);
  const [visibleForm, setVisibleForm] = useState('manual');
  const [dataSource, setDataSource] = useState<string>("");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [renderedTables, setRenderedTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [tableMetadata, setTableMetadata] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [defaultMetricSelected, setDefaultMetricSelected] = useState(true);
  const [isFormValid, setIsFormValid] = useState(false);
  // TODO: useState containing the main time dimension variableCode for PxWeb tables, or null if no main time dimension has been determined yet or the API is not in PxWeb format.

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

    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    void getTables(dataSource, query, lang).then(result => { setTables(result); setIsLoading(false); });
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
            renderedTablesListMaxLength,
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
    const metricSelectElements = document.querySelectorAll("select.metric");
    if (metricSelectElements.length > 0) {
      const hasUnselectedMetric = Array.from(metricSelectElements).some((select) => {
        return select instanceof HTMLSelectElement && select.value.length === 0;
      });
      setDefaultMetricSelected(hasUnselectedMetric);
    } else {
      setDefaultMetricSelected(true);
    }
  }, [tableMetadata]);

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

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Return if insufficient selection has been made
    if (!tables) return;
    // Return if properly formatted response was not found
    if (!tableContent) return;
    if (!(event.target instanceof HTMLFormElement)) return;

    if (!(event.target.checkValidity())) return;
    const formData = new FormData(event.target);
    const query = formQueryHelper(formData, tableMetadata /* TODO: include any PxWeb main time variable */);

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

  const tryGetResult: ChangeEventHandler = (event) => {
    // null check
    if (!(formRef.current instanceof HTMLFormElement)) return;

    setIsLoading(true);

    // Get a result if the form is valid
    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = formQueryHelper(formData, tableMetadata /* TODO: include any PxWeb main time variable */);
      const tableId = tableMetadata?.tableId ?? formData.get("externalTableId") as string ?? "";
      getTableContent(tableId, dataSource, query, lang).then(result => {
        setTableContent(result);
        if ((result?.values.length ?? 0) > 0) {
          enableSubmitButton();
        } else {
          disableSubmitButton();
        }
        setIsLoading(false);
      }).catch((err: unknown) => {
        console.error("Error fetching table content:", err);
        setTableContent(null);
        disableSubmitButton();
        setIsLoading(false);
      });
      if (dataSource === "Trafa") {
        const changedSelect = event?.target instanceof HTMLSelectElement ? event.target : null;
        // If metric was changed, send the metric as a query to the API to get filtered table metadata
        if (
          changedSelect
          && tableMetadata?.metricDimensions.some(metricDimension => metricDimension.id === changedSelect.name)
        ) {
          const metricVariableCodes = tableMetadata.metricDimensions.map(metricDimension => metricDimension.id);
          void getTableMetadata(tableId, dataSource, query.filter(q => metricVariableCodes.includes(q.variableCode)), lang).then(result => { setTableMetadata(result); });
        }
      }
    }
    // If not, make sure the submit button is disabled
    else {
      disableSubmitButton();
      clearTableContent();
      setIsLoading(false);
    }
  };

  const formChange: ChangeEventHandler = (event) => {
    setIsFormValid(formRef.current?.checkValidity() ?? false);

    const changedElementIsExternalDataset = event.target instanceof HTMLSelectElement && event.target.name === "externalDataset";
    const changedElementIsTableSearch = event.target instanceof HTMLInputElement && event.target.name === "tableSearch";
    const changedElementIsTable = event.target instanceof HTMLInputElement && event.target.name === "externalTableId";

    if (!changedElementIsExternalDataset && !changedElementIsTableSearch && !changedElementIsTable && tables && tableMetadata) {
      tryGetResult(event);
    }
  };

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
    if (!dataSource || !ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;

    void getTables(dataSource, query, lang).then(result => setTables(result));
  }

  function clearTableMetadata() {
    setTableMetadata(null);
  }

  function clearTableContent() {
    setTableContent(null);
  }

  function handleDataSourceSelect(dataSource: string) {
    setDataSource(dataSource);
    // Clear table metadata and content whenever the data source changes
    clearTableContent();
    clearTableMetadata();
    // Make sure submit button is disabled when the data source is changed
    disableSubmitButton();
  }

  function handleTableSelect(tableId: string) {
    setIsLoading(true);

    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;
    if (!tableId) return;

    clearTableContent();
    clearTableMetadata();
    disableSubmitButton();

    void getTableMetadata(tableId, dataSource, undefined, lang).then(result => { setTableMetadata(result); setIsLoading(false); });
  }

  function handleMetricSelect(_event: React.ChangeEvent<HTMLSelectElement>) {
    setIsLoading(true);
    const metricSelectElements = formRef.current?.querySelectorAll("select.metric") ?? [];
    const hasUnselectedMetric = Array.from(metricSelectElements).some((select) => {
      return select instanceof HTMLSelectElement && select.value.length === 0;
    });
    setDefaultMetricSelected(hasUnselectedMetric);
    const variableSelectionFieldSets = document?.getElementsByName("variableSelectionFieldset");

    if (variableSelectionFieldSets.length > 0) {
      variableSelectionFieldSets.forEach(variableSelectionFieldset => {
        if (!hasUnselectedMetric && variableSelectionFieldset.hasAttribute("disabled")) {
          variableSelectionFieldset.removeAttribute("disabled");
        }
        else if (hasUnselectedMetric) {
          // Reset the selection of all select elements in the variable fieldset before disabling
          variableSelectionFieldset.querySelectorAll("select").forEach(select => {
            select.value = "";
          });
          variableSelectionFieldset.setAttribute("disabled", "true");
          // Reset all the table metadata when disabling the form so all options are displayed when re-enabling
          if (dataSource === "Trafa") {
            void getTableMetadata(tableMetadata?.tableId ?? "", dataSource, undefined, lang).then(result => { setTableMetadata(result); setIsLoading(false); });
          }
          else {
            setIsLoading(false);
          }
        }
      });
    } else {
      setIsLoading(false);
    }
  }

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean | null | undefined) {
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

  function metricSelectionHelper(metricDimension: ApiMetadataDimensionBase, tableMetadata: ApiTableMetadata) {
    if (metricDimension.options) {
      return (
        <label key={`metric-${tableMetadata.tableId}-${metricDimension.id}`} className="block margin-block-75">
          {metricDimension.label || metricDimension.name}
          <select className="block margin-block-25 metric"
            required={true}
            name={metricDimension.id}
            id={metricDimension.id}
            defaultValue={ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && metricDimension.options?.length === 1
              ? metricDimension.options[0].value
              : undefined}
            onChange={handleMetricSelect}>
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

  type VariableSelectionHelperOptions = {
    classNames?: string[],
  }
  function variableSelectionHelper(dimension: ApiMetadataDimensionBase, tableMetadata: ApiTableMetadata, options?: VariableSelectionHelperOptions) {
    if (dimension.options) {
      return (
        <label key={dimension.id} className={`block margin-block-75 ${options?.classNames?.map((className: string) => className).join(" ")}`}>
          {/* Only display "optional" tags if the data source provides this information */}
          <span style={{ textTransform: "capitalize" }}>
            {dimension.label || dimension.name}{optionalTag(dataSource, dimension.optional)}
          </span>
          {/* TODO: Use CSS to set proper capitalization of labels; something like `label::first-letter { text-transform: capitalize; }` */}
          <select className={`block margin-block-25 ${dimension.label ?? dimension.name}`}
            required={!dimension.optional}
            name={dimension.id}
            id={dimension.id}
            defaultValue={ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" ?
              (// If only one value is available, pre-select it
                dimension.options?.length === 1 ? dimension.options[0].value : undefined
              )
              :
              undefined
            }>
            { // If only one value is available, don't show a placeholder option
              ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && dimension.options.length > 1 ? <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option> : null
            }
            {
              !(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") &&
              <option value="" className={`font-style-italic color-gray`}>{t("components:query_builder.select_value")}</option>
            }
            {dimension.options?.map(({ label, value }) => (
              <option key={`${dimension.id}-${value}`} value={value} lang={tableMetadata.language}>{label || value}</option>
            ))}
          </select>
        </label>
      );
    }
  }

  function timeVariableSelectionHelper(time: ApiMetadataDimensionBase, language?: string) {
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
      <label key={`${time.id}`} className="block margin-block-75">
        {heading}{optionalTag(dataSource, time.optional ?? false)}
        <select
          className={`block margin-block-25 TimeVariable`}
          required={!time.optional}
          name={time.id}
          id={time.id}
          defaultValue={time.options.length === 1 ? time.options[0].value : ""}>
          <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
          {time.options.map(({ value, label }) => (
            <option key={`${time.id}-${label || value}`} value={value} lang={language}>{label || value}</option>
          ))}
        </select>
      </label>
    );
  }

  function shouldVariableFieldsetBeVisible(tableMetadata: ApiTableMetadata, dataSource: string) {
    const returnBool = ((tableMetadata.hierarchies && tableMetadata.hierarchies.length > 0) || (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableMetadata.regularDimensions.some(variable => variable.options.length > 0)) || tableMetadata.timeDimensions.length > 1);
    return returnBool;
  }

  return (
    <>
      {goal.historicalId
        ?
        <>
          <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem", lineHeight: '1.5' }} onClick={() => openModal(modalRef)}>
            {t("components:query_builder.change_historical_data")}
            <IconChartHistogram width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
          </button>

          <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem", lineHeight: '1.5' }} onClick={deleteHistoricalData}>
            {t("components:query_builder.remove_historical_data")}
            <IconTrashXFilled fill='#CB3C3C' width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
          </button>
        </>
        :
        <button type="button" className="gray-90 flex align-items-center gap-25 font-weight-500" style={{ fontSize: ".75rem", padding: ".3rem .6rem", lineHeight: '1.5' }} onClick={() => openModal(modalRef)}>
          {t("components:query_builder.add_historical_data")}
          <IconChartHistogram width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />

        </button>
      }

      <dialog className={`rounded padding-inline-0 padding-block-0 ${styles.dialog}`} ref={modalRef} aria-modal={true}>
        <div className={`${styles['dialog-content']}`}>
          <div className={`${styles['dialog-header']}`}>
            <button type="button" className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus={true} aria-label={t("common:tsx.close")} >
              <IconX strokeWidth={3} width={28} height={28} style={{ minWidth: '28px' }} aria-hidden="true" />
            </button>
            <h2 className="margin-0">{t("components:query_builder.add_data_source")}</h2> {/* Title needs to change to as we are not necessarily adding a data source here now */}
          </div>

          <div className={`${styles['dialog-body']}`}>
            {/* <p className="padding-inline-100">{t("components:query_builder.add_data_to_goal", { goalName: goal.name ?? goal.indicatorParameter })}</p> */}

            {/* TODO: It might be sensible if these are tabs instead. Or if we warn users that data will be deleted given that you switch between them */}
            <div className="radio-select-two margin-bottom-100" > {/* TODO: Make sure these wrap */}
              <label id="recipe-type-suggested-label">
                {t("components:query_builder.add_data_manually")}
                <input
                  className="margin-right-25"
                  type="radio"
                  name="visible-form"
                  id="visible-form-manual"
                  value="manual"
                  checked={visibleForm === "manual"}
                  onChange={() => {
                    setVisibleForm("manual");
                  }}
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
                  onChange={() => {
                    setVisibleForm("external");
                  }}
                />
              </label>
            </div>

            {visibleForm === 'manual' ?
              <div>
                <DataSeriesGrid id="dataseries" label={t("forms:data_series_input.data_series")} />
              </div>
              : visibleForm === 'external' ?
                <form ref={formRef} onChange={formChange} onSubmit={handleSubmit} className="flex flex-direction-column flex-grow-1" style={{ minHeight: '0' }}>
                  {/* Hidden disabled submit button to prevent accidental submission */}
                  <button type="submit" className="display-none" disabled={true}></button>
                  <strong
                    id="loader"
                    className={`position-absolute gray-80 padding-block-100 smooth ${!isLoading && "hidden"}`}
                    style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 100, opacity: "0.75" }}>
                    {t("components:query_builder.loading")}
                  </strong>

                  <FormWrapper>
                    <fieldset className="position-relative flex flex-direction-column" style={{ height: '100%' }}>
                      <label className="margin-block-75 font-weight-500">
                        {t("components:query_builder.data_source")}
                        {/* Display warning message if the selected language is not supported by the api */}
                        {((ExternalDataset.getDatasetByAlternateName(dataSource)) && !(ExternalDataset.getDatasetByAlternateName(dataSource)?.supportedLanguages.includes(lang))) ?
                          <small className="font-weight-normal font-style-italic margin-left-50" style={{ color: "red" }}>{t("components:query_builder.language_support_warning", { dataSource: dataSource })}</small>
                          : null}
                        <select className="block margin-block-25 width-100" required={true} name="externalDataset" id="externalDataset" onChange={e => { handleDataSourceSelect(e.target.value); }}>
                          <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_source")}</option>
                          {ExternalDataset.knownDatasetKeys.map((name) => (
                            <option key={name} value={name}>{ExternalDataset[name]?.fullName}</option>
                          ))}
                        </select>
                      </label>

                      {dataSource ?
                        <div className="purewhite smooth padding-50 flex flex-direction-column" style={{ border: '1px solid var(--gray-80)', minHeight: '0' }}> {/* TODO: This whole listthing should be a combobox  */}
                          <div className="margin-top-100 margin-bottom-25">
                            {/* TODO: Label currently affects multiple elements, fix this (will get fixed once this is a combobox as live search removes need for a button) */}
                            <label className="font-weight-500">
                              {t("components:query_builder.search_for_table")}
                              <div className="focusable flex align-items-center margin-top-25 " style={{ border: '0', borderBottom: '1px solid var(--gray-80)', borderRadius: '0' }}>
                                <IconSearch strokeWidth={1.5} style={{ minWidth: '24px' }} aria-hidden="true" />
                                <input name={tableSearchInputName} type="search" className="padding-0 margin-inline-50" placeholder={t("forms:combobox.default_search_placeholder")} onKeyDown={searchOnEnter} style={{ backgroundColor: "transparent" }} />
                                <button type="button" onClick={searchWithButton} className="padding-block-50 padding-inline-100 transparent font-weight-500">{t("components:query_builder.search")}</button>
                              </div>
                            </label>
                          </div>

                          <ul
                            id="tablesList"
                            className={`position-relative padding-right-25 padding-left-0 ${styles['tableList']}`} onScroll={e => handleTableListScroll(e)}
                            style={{ listStyle: "none" }} >
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
                                  onClick={e => handleTableSelect((e.target as HTMLButtonElement).value)}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                        : null}

                    </fieldset>

                    {tableMetadata ? <>
                      <label className="block margin-block-75">
                        <Trans
                          i18nKey={"components:query_builder.selected_table"}
                          values={{ table: document.getElementById(`table${tableMetadata.tableId}`)?.innerText }}
                          components={{ strong: <strong />, small: <small />, i: <i /> }}
                        />
                        {/* {t("components:query_builder.selected_table", { table: document.getElementById(`table${tableMetadata.id}`)?.innerText })} */}
                      </label>
                      <fieldset className="margin-block-100 smooth padding-50" style={{ border: "1px solid var(--gray-90)" }}>
                        <legend className="padding-inline-50">
                          <b>{t("components:query_builder.select_metric_for_table")}</b>
                        </legend>
                        <div>
                          {tableMetadata.metricDimensions?.map((metricDimension) => (
                            metricSelectionHelper(metricDimension, tableMetadata)
                          ))}
                        </div>
                      </fieldset>
                      <fieldset name="variableSelectionFieldset" disabled={true} className={`margin-block-100 smooth padding-25 fieldset-unset-pseudo-class`} style={{ border: `${shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? "1px solid var(--gray-90)" : ""}`, maxHeight: "322px" }}>
                        {shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? (
                          <>
                            <legend className="padding-inline-50">
                              <b>{t("components:query_builder.select_values_for_table")}</b>
                            </legend>
                            <div className={`${styles.temporary}`} style={{ maxHeight: "282px", boxSizing: "content-box", padding: ".25rem", paddingRight: ".375rem" }}>
                              {tableMetadata.timeDimensions?.map(time => {
                                return timeVariableSelectionHelper(time, tableMetadata.language);
                              })}
                              {tableMetadata.regularDimensions.map(variable => {
                                return variableSelectionHelper(variable, tableMetadata);
                              })}
                              {tableMetadata.hierarchies?.map(hierarchy => {
                                if (hierarchy.children?.some(variable => variable.options.length > 0)) return (
                                  <label key={hierarchy.name} className="block margin-block-75">
                                    <b>{hierarchy.label}</b>
                                    {hierarchy.children?.map(variable => {
                                      return variableSelectionHelper(variable, tableMetadata, { classNames: ["margin-left-75"] });
                                    })}
                                  </label>
                                );
                              })}
                            </div>
                          </>) : (<p className={`font-style-italic color-gray`}>{t("components:query_builder.no_variables_found")}</p>)}
                      </fieldset>

                    </> : null}
                  </FormWrapper>
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
                      !defaultMetricSelected &&
                      isFormValid && (
                        <p className="padding-100">{t("components:query_builder.no_result_found")}</p>
                      )
                    }
                  </output>
                  {/* TODO: Should probably only be displayed on last slide? */}
                  <button
                    id="submit-button"
                    disabled={true}
                    type="submit"
                    className="display-none seagreen color-purewhite block"
                  >
                    {t("components:query_builder.add_data_source_button")}
                  </button>

                </form>
                : null}
          </div>
        </div>
      </dialog>
    </>
  );
}