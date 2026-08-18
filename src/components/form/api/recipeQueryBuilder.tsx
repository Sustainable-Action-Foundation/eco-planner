"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import type { ApiMetadataDimensionBase, ApiSelectionItem, ApiTableContent, ApiTableListEntry, ApiTableMetadata } from "@/lib/api/apiTypes";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { ExternalDataset, formQueryHelper, isDataSetKeys } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";
import { IconDatabaseSearch, IconSearch, IconX } from "@tabler/icons-react";
import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import getTableContent from "@/lib/api/getTableContent";
import { externalSelectionKey } from "@/functions/recipe";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";

// TODO: move-history-v3: replace this with external data component once we are done!

export default function RecipeQueryBuilder({
  variableId,
  initialDataSource,
  initialTableId,
  initialSelection,
}: {
  variableId: string;
  initialDataSource?: string;
  initialTableId?: string;
  initialSelection?: ApiSelectionItem[];
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
  const [tables, setTables] = useState<ApiTableListEntry[] | null>(null);
  const [offset, setOffset] = useState(0);
  const [tableSearch, setTableSearch] = useState("");
  const [variableFilters, setVariableFilters] = useState<string[]>([]);
  const [timeUnitFilter, setTimeUnitFilter] = useState("");
  const [coverageYearFilter, setCoverageYearFilter] = useState("");
  const [tableMetadata, _setTableMetadata] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [mainTimeDimensionId, setMainTimeDimensionId] = useState<string | null>(null);
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

  // Client-side filtering of the fetched table catalog; all active filters are ANDed together.
  const filteredTables = useMemo(() => {
    if (!tables) return null;
    const search = tableSearch.trim().toLowerCase();
    const coverageYear = /^\d{4}$/.test(coverageYearFilter.trim()) ? parseInt(coverageYearFilter.trim(), 10) : null;

    return tables.filter(table => {
      if (search && !table.label.toLowerCase().includes(search) && !table.tableId.toLowerCase().includes(search)) return false;
      if (variableFilters.length > 0) {
        const names = table.variableNames?.map(name => name.toLowerCase()) ?? [];
        if (!variableFilters.every(filter => names.includes(filter))) return false;
      }
      if (timeUnitFilter && table.timeUnit !== timeUnitFilter) return false;
      if (coverageYear !== null) {
        // Sub-yearly periods like "2024K2" parse to their year, since parseInt stops at the first non-digit
        const firstYear = parseInt(table.firstPeriod ?? "", 10);
        const lastYear = parseInt(table.lastPeriod ?? "", 10);
        if (Number.isNaN(firstYear) || Number.isNaN(lastYear) || coverageYear < firstYear || coverageYear > lastYear) return false;
      }
      return true;
    });
  }, [tables, tableSearch, variableFilters, timeUnitFilter, coverageYearFilter]);

  // Variable facet options aggregated over the whole catalog, keyed case-insensitively
  // since sources are inconsistent about capitalization.
  const variableFacetOptions = useMemo(() => {
    const counts = new Map<string, { key: string, name: string, count: number }>();
    for (const table of tables ?? []) {
      for (const name of table.variableNames ?? []) {
        // Some PxWeb sources report their contents dimension under this placeholder rather than a real variable name
        if (name === "ApiContentsVariableName") continue;
        const key = name.toLowerCase();
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { key, name, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tables]);

  const timeUnitFacetOptions = useMemo(() => {
    const presentUnits = new Set((tables ?? []).map(table => table.timeUnit));
    return (["Annual", "Quarterly", "Monthly", "Weekly", "Other"] as const).filter(unit => presentUnits.has(unit));
  }, [tables]);

  const activeFilterCount = variableFilters.length + (timeUnitFilter ? 1 : 0) + (coverageYearFilter.trim() ? 1 : 0);

  const shouldRenderAllTables = (filteredTables?.length ?? 0) <= renderedTablesListMaxLength + initialRenderingMargin;
  const renderedTables = filteredTables
    ? filteredTables.slice(
      shouldRenderAllTables ? 0 : offset,
      shouldRenderAllTables ? filteredTables.length : offset + renderedTablesListMaxLength,
    )
    : null;

  const setTableMetadata = useCallback((nextTableMetadata: ApiTableMetadata | null) => {
    _setTableMetadata(prev => {
      if (!nextTableMetadata) {
        // If no metadata is available, clear the selected main time dimension.
        setMainTimeDimensionId(null);
      } else if (prev?.tableId !== nextTableMetadata.tableId || prev?.timeDimensions !== nextTableMetadata.timeDimensions) {
        // For one time dimension, use it as the main dimension; otherwise let the user choose.
        if (nextTableMetadata.timeDimensions.length === 1) {
          setMainTimeDimensionId(nextTableMetadata.timeDimensions[0].id);
        } else {
          setMainTimeDimensionId(null);
        }
      }
      return nextTableMetadata;
    });
  }, []);

  // Get tables when source or language changes.
  useEffect(() => {
    if (!dataSource) return;

    getTables(dataSource, lang)
      .then(result => {
        setTables(result);
        setOffset(0);
        // Old filters are meaningless against a new catalog (or a new catalog language)
        setTableSearch("");
        setVariableFilters([]);
        setTimeUnitFilter("");
        setCoverageYearFilter("");
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching tables:", errorMessage);
        setTables(null);
      })
      .finally(() => setIsLoading(false));
  }, [dataSource, lang]);

  // If we got an initial table, load its metadata.
  useEffect(() => {
    if (!dataSource || !initialTableId || hasAppliedInitialTableSelectionRef.current) return;
    if (!tables?.some(table => table.tableId === initialTableId)) return;
    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;

    hasAppliedInitialTableSelectionRef.current = true;
    getTableMetadata(initialTableId, dataSource, undefined, lang)
      .then(result => { setTableMetadata(result); })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching initial table metadata:", errorMessage);
        setTableMetadata(null);
      })
      .finally(() => setIsLoading(false));
  }, [dataSource, initialTableId, lang, setTableMetadata, tables]);

  // Run one first query when initial values are set.
  useEffect(() => {
    if (!tableMetadata || !initialSelection?.length || hasAppliedInitialSelectionRef.current) return;
    if (!(selectorMenuRef.current instanceof HTMLDivElement)) return;

    const metricSelectElements = selectorMenuRef.current.querySelectorAll("select.metric");
    if (metricSelectElements.length === 0) return;

    const hasUnselectedMetric = Array.from(metricSelectElements).some((select) => {
      return select instanceof HTMLSelectElement && !select.value;
    });
    if (hasUnselectedMetric) return;

    hasAppliedInitialSelectionRef.current = true;
    const firstMetricSelect = metricSelectElements[0];
    if (firstMetricSelect instanceof HTMLSelectElement) {
      firstMetricSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, [initialSelection, tableMetadata]);

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
    }
  }

  function clearTableFilters() {
    setTableSearch("");
    setVariableFilters([]);
    setTimeUnitFilter("");
    setCoverageYearFilter("");
    setOffset(0);
  }

  function timeUnitLabel(timeUnit: NonNullable<ApiTableListEntry["timeUnit"]>) {
    switch (timeUnit) {
      case "Annual": return t("components:query_builder.time_unit_annual");
      case "Quarterly": return t("components:query_builder.time_unit_quarterly");
      case "Monthly": return t("components:query_builder.time_unit_monthly");
      case "Weekly": return t("components:query_builder.time_unit_weekly");
      case "Other": return t("components:query_builder.time_unit_other");
      default: return timeUnit;
    }
  }


  function handleDataSourceSelect(dataSource: string) {
    setIsLoading(true);
    setDataSource(dataSource);
    setSelectedTableId("");
    setDefaultMetricSelected(true);
    setOffset(0);
    hasAppliedInitialTableSelectionRef.current = false;
    hasAppliedInitialSelectionRef.current = false;
    // Clear table metadata and content whenever the data source changes
    setTableContent(null);
    setTableMetadata(null);
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
    setTableMetadata(null);

    getTableMetadata(tableId, dataSource, undefined, lang)
      .then(result => { setTableMetadata(result); })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table metadata:", errorMessage);
        setTableMetadata(null);
      })
      .finally(() => setIsLoading(false));
  }

  function handleMetricSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    tryGetResult(event);
    setIsLoading(true);
    const metricSelectElements = selectorMenuRef.current?.querySelectorAll("select.metric") ?? [];
    const hasUnselectedMetric = Array.from(metricSelectElements).some((select) => {
      return select instanceof HTMLSelectElement && !select.value;
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
            getTableMetadata(tableMetadata?.tableId ?? "", dataSource, undefined, lang)
              .then(result => { setTableMetadata(result); })
              .catch((err: unknown) => {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error("Error resetting table metadata:", errorMessage);
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
    if (event.target && event.target instanceof HTMLElement && filteredTables && event.target.children.length < filteredTables.length) {
      if ( // This block is only executed when the user scrolls down
        renderedTables
        &&
        /* Check if the user has scrolled far enough to render more tables (including some margin so the scroll does not get stuck at the bottom while waiting for more tables to render) */
        event.target.scrollTop + event.target.clientHeight * 2 >= event.target.scrollHeight
        &&
        /* Make sure that the very last table has not been rendered */
        !renderedTables.includes(filteredTables[filteredTables.length - 1])
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
        !renderedTables.includes(filteredTables[0])
      ) {
        const newOffset = Math.max(offset - tablesListRenderingChunkSize, 0);
        setOffset(newOffset);
      }
    }
  }

  function metricSelectionHelper(metricDimension: ApiMetadataDimensionBase, tableMetadata: ApiTableMetadata) {
    if (metricDimension.options) {
      return (
        <label key={`metric-${tableMetadata.tableId}-${metricDimension.id}`} className="block margin-block-75">
          {metricDimension.label || metricDimension.name}
          <select
            className="block margin-block-25 metric"
            required={true}
            name={metricDimension.id}
            id={metricDimension.id}
            defaultValue={
              getInitialSelectionValue(metricDimension.id)
              ??
              (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && metricDimension.options.length === 1
                ? metricDimension.options[0].value
                : undefined)
            }
            onChange={handleMetricSelect}>
            {((ExternalDataset.getDatasetByAlternateName(dataSource)?.api !== "PxWeb") || metricDimension.options.length > 1)
              ? <option value="" className="font-style-italic color-gray">{t("components:query_builder.select_metric")}</option>
              : null}
            {metricDimension.options?.map(({ label, value }) => (
              <option key={`${metricDimension.id}-${value}`} value={value} lang={tableMetadata.language}>{label || value}</option>
            ))}
          </select>
        </label>
      );
    }
  }

  function variableSelectionHelper(dimension: ApiMetadataDimensionBase, tableMetadata: ApiTableMetadata, options?: { classNames?: string[], }) {
    if (dimension.options) {
      return (
        <label key={dimension.id} className={`block margin-block-75 ${options?.classNames?.map((className: string) => className).join(" ")}`}>
          {/* Only display "optional" tags if the data source provides this information */}
          <span style={{ "textTransform": "capitalize" }}>
            {dimension.label || dimension.name}{optionalTag(dataSource, dimension.optional ?? false)}
          </span>
          {/* TODO: Use CSS to set proper capitalization of labels; something like `label::first-letter { text-transform: capitalize; }` */}
          <select
            onChange={tryGetResult}
            className={`block margin-block-25 ${dimension.label}`}
            required={!dimension.optional}
            name={dimension.id}
            id={dimension.id}
            defaultValue={
              getInitialSelectionValue(dimension.id)
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
      <label key={`${time.id}`} className="block margin-block-75">
        {heading}{optionalTag(dataSource, time.optional ?? false)}
        <select
          onChange={tryGetResult}
          className={`block margin-block-25 TimeVariable`}
          required={!time.optional}
          name={time.id}
          id={time.id}
          defaultValue={getInitialSelectionValue(time.id) ?? (time.options.length === 1 ? time.options[0].value : "")}>
          <option value="" className={`font-style-italic color-gray`}>{defaultValue}</option>
          {time.options.map(({ value, label }) => (
            <option key={`${time.id}-${label || value}`} value={value} lang={language}>{label || value}</option>
          ))}
        </select>
      </label>
    );
  }

  function shouldVariableFieldsetBeVisible(tableMetadata: ApiTableMetadata, dataSource: string) {
    // Show if there are hierarchies.
    if (tableMetadata.hierarchies && tableMetadata.hierarchies.length > 0) return true;
    // Show if there is a selection to be made for any regular dimension.
    if (tableMetadata.regularDimensions.some(variable => variable.options.length > 1)) return true;
    // For non-PxWeb, single-option dimensions are not auto-selected, so any available option should be shown.
    if (!(ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb") && tableMetadata.regularDimensions.some(variable => variable.options.length > 0)) return true;
    // Show if any time dimension has more than one option.
    if (tableMetadata.timeDimensions.some(time => time.options.length > 1)) return true;
    return false;
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

    const query = formQueryHelper(formData, tableMetadata, mainTimeDimensionId);
    const tableId = tableMetadata?.tableId ?? formData.get("externalTableId") as string ?? "";
    getTableContent(tableId, dataSource, query, lang).then(result => {
      setTableContent(result);
      setIsLoading(false);
    }).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error fetching table content:", errorMessage);
      setTableContent(null);
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
        getTableMetadata(tableId, dataSource, query.filter(q => metricVariableCodes.includes(q.variableCode)), lang)
          .then(result => { setTableMetadata(result); })
          .catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("Error fetching metric-filtered table metadata:", errorMessage);
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

    const query = formQueryHelper(formData, tableMetadata, mainTimeDimensionId);

    upsertVariable(variableId, prev => {
      if (prev.type !== RecipeDataTypes.External) return prev;

      const nextDataset = isDataSetKeys(dataSource) ? dataSource : prev.dataset;
      const nextTableId = tableMetadata?.tableId ?? formData.get("externalTableId") as string ?? prev.tableId;

      // If the selection actually changed, invalidate the materialized series so it
      // is re-fetched; otherwise keep it as canon (no refetch).
      const newSelectionKey = externalSelectionKey(nextDataset, nextTableId, query);
      const prevSelectionKey = externalSelectionKey(prev.dataset, prev.tableId, prev.selection);
      const selectionChanged = newSelectionKey !== prevSelectionKey;

      return {
        ...prev,
        dataset: isDataSetKeys(dataSource) ? dataSource : prev.dataset,
        tableId: tableMetadata?.tableId ?? formData.get("externalTableId") as string ?? prev.tableId,
        selection: query,
        dataSeriesId: selectionChanged ? null : prev.dataSeriesId,
      };
    });
    closeModal(modalRef);
  }

  return (
    <>
      <button
        type="button"
        className="purewhite flex justify-content-space-between align-items-center gap-25 padding-50 font-size-14px width-100"
        style={{ border: '1px solid var(--gray-80)', transform: 'scale(1)', color: dataSource && tableMetadata?.tableId && tableContent?.metadata[0].label ? 'black' : 'gray' }}
        onClick={() => openModal(modalRef)}
      // TODO: This needs a title in case of overflow...
      >
        <span className="white-space-nowrap">
          {dataSource && tableMetadata?.tableId
            ? `${dataSource}(${tableMetadata.tableId}) - `
            : t("components:recipe_editor.add_external_data")
          }
        </span>
        {dataSource && tableMetadata?.tableId ? <span
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
                      <label className="font-weight-500">
                        {t("components:query_builder.search_for_table")}
                        <div className="focusable purewhite flex align-items-center margin-top-25 padding-left-50 smooth">
                          <IconSearch strokeWidth={1.5} style={{ minWidth: '24px' }} aria-hidden="true" />
                          <input
                            name={tableSearchInputName}
                            type="search"
                            className="padding-50 margin-inline-50 flex-grow-100"
                            value={tableSearch}
                            onChange={e => { setTableSearch(e.target.value); setOffset(0); }}
                            onKeyDown={searchOnEnter}
                            style={{ backgroundColor: "transparent" }}
                          />
                        </div>
                      </label>
                    </div>

                    <details className="margin-bottom-25 smooth purewhite padding-50" style={{ border: "1px solid var(--gray-80)" }}>
                      <summary className="font-weight-500" style={{ cursor: "pointer" }}>
                        {t("components:query_builder.filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                      </summary>

                      {variableFacetOptions.length > 0 ?
                        <fieldset className="margin-block-50 padding-0" style={{ border: "none" }}>
                          <legend className="font-weight-500">{t("components:query_builder.filter_by_variable")}</legend>
                          <div className={`${styles.temporary}`} style={{ maxHeight: "150px", overflowY: "auto" }}>
                            {variableFacetOptions.map(({ key, name, count }) => (
                              <label key={key} className="flex align-items-center gap-25 padding-block-25">
                                <input
                                  type="checkbox"
                                  checked={variableFilters.includes(key)}
                                  onChange={e => {
                                    setVariableFilters(prev => e.target.checked ? [...prev, key] : prev.filter(filter => filter !== key));
                                    setOffset(0);
                                  }}
                                />
                                <span style={{ textTransform: "capitalize" }}>{name}</span>
                                <small className="color-gray">({count})</small>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        : null}

                      {timeUnitFacetOptions.length > 0 ?
                        <label className="block margin-block-50">
                          {t("components:query_builder.filter_by_time_unit")}
                          <select className="block margin-block-25 width-100" value={timeUnitFilter} onChange={e => { setTimeUnitFilter(e.target.value); setOffset(0); }}>
                            <option value="">{t("components:query_builder.any_time_unit")}</option>
                            {timeUnitFacetOptions.map(unit => (
                              <option key={unit} value={unit}>{timeUnitLabel(unit)}</option>
                            ))}
                          </select>
                        </label>
                        : null}

                      {tables?.some(table => table.firstPeriod && table.lastPeriod) ?
                        <label className="block margin-block-50">
                          {t("components:query_builder.filter_has_data_for_year")}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1900}
                            max={2200}
                            className="block margin-block-25"
                            value={coverageYearFilter}
                            onChange={e => { setCoverageYearFilter(e.target.value); setOffset(0); }}
                            onKeyDown={searchOnEnter}
                          />
                        </label>
                        : null}

                      {activeFilterCount > 0 || tableSearch ?
                        <button type="button" className="transparent padding-block-25 padding-inline-50 font-weight-500" onClick={clearTableFilters}>
                          {t("components:query_builder.clear_filters")}
                        </button>
                        : null}
                    </details>

                    {tables && filteredTables ?
                      <p className="margin-block-25 font-size-14px color-gray">
                        {t("components:query_builder.showing_table_count", { shown: filteredTables.length, total: tables.length })}
                      </p>
                      : null}

                    <ul
                      id="tablesList"
                      className={`position-relative padding-25 smooth purewhite ${styles.temporary}`} onScroll={e => handleTableListScroll(e)}
                      style={{ maxHeight: "300px", border: "1px solid var(--gray-80)", listStyle: "none", overflowY: 'scroll' }} >
                      {filteredTables?.length === 0 ?
                        <li className="padding-block-25 font-style-italic color-gray">{t("components:query_builder.no_tables_match_filters")}</li>
                        : null}
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

              {tableMetadata ? <div ref={selectorMenuRef}>
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
                          return (
                            <label key={hierarchy.id} className="block margin-block-75">
                              <b>{hierarchy.label || hierarchy.name}</b>
                              {hierarchy.children?.map(variable => {
                                return variableSelectionHelper(variable, tableMetadata, { classNames: ["margin-left-75"] });
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