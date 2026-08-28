"use client";

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import type { ApiMetadataDimensionBase, ApiSelectionItem, ApiTableContent, ApiTableListEntry, ApiTableMetadata } from "@/lib/api/apiTypes";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { aggregateTimeUnitFacets, aggregateVariableFacets, filterTableCatalog, PXWEB_CONTENTS_PLACEHOLDER } from "@/lib/api/tableCatalog";
import { ExternalDataset, formQueryHelper, isDataSetKeys } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import SelectMultipleSearch from "../elements/combobox/selectMultipleSearch";
import FormWrapper from "../formWrapper";
import styles from "./queryBuilder.module.css";
import { IconDatabaseSearch, IconSearch, IconX } from "@tabler/icons-react";
import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import getTableContent from "@/lib/api/getTableContent";
import { externalSelectionKey } from "@/functions/recipe";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import { isMathjsUnit } from "@/functions/recipe/vectorAndMaskUtils";
import { isUnitFlag, parseUnit } from "@/functions/unit";
import { allOurUnits } from "@/math";
import TextSingleAutocomplete from "../elements/combobox/textSingleAutocomplete";

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
  const { upsertVariable, getVariable } = useRecipe();
  const variable = getVariable(variableId, RecipeDataTypes.External);

  // The unit of the fetched data is not derivable from the APIs in general (Trafa
  // never states it, PxWeb sometimes does), so the user declares it here and it is
  // saved onto the variable. Seeded from the variable, then from a reported unit
  // until the user types something.
  const [unitInput, setUnitInput] = useState<string>(variable && !isUnitFlag(variable.unit) ? variable.unit : "");
  const unitTouchedRef = useRef(false);
  // Descriptions of the currently selected metric(s); often the only place the source states a unit
  const [metricDescriptions, setMetricDescriptions] = useState<string[]>([]);

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
  // The variable filter combobox is uncontrolled, so it is reset by remounting via this key
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [tableMetadata, _setTableMetadata] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [mainTimeDimensionId, setMainTimeDimensionId] = useState<string | null>(null);
  const [defaultMetricSelected, setDefaultMetricSelected] = useState(true);
  const hasAppliedInitialTableSelectionRef = useRef(false);
  // Which page of the dialog to show; bumped to the selection page once a preset table has loaded
  const [section, setSection] = useState(0);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const selectorMenuRef = useRef<HTMLDivElement | null>(null);

  // The dialog is portaled to <body> because this component mounts inside other
  // forms (goal form fieldsets, via external recipe variables): as a descendant,
  // its required selects would join that form's native validation and silently
  // veto submission while sitting invisible in the closed dialog. The builder
  // reads its own controls through refs, so it needs no form owner. Portals
  // can't render during SSR, hence the mounted gate.
  const [isPortalMounted, setIsPortalMounted] = useState(false);
  useEffect(() => { setIsPortalMounted(true); }, []);

  const tableSearchInputName = "tableSearch";

  // These variables determine how many tables are rendered at a time, and how many are rendered when the user scrolls down/up
  // The first number is the amount of tables that are rendered when the user scrolls down/up, and the second number is the maximum amount of tables that are rendered at once.
  // The initial rendering margin allows for more than the maximum amount of tables to be rendered at once if the total amount of tables is less than the maximum amount of tables plus the margin (currently adding to 115).
  const tablesListRenderingChunkSize = 50;
  const renderedTablesListMaxLength = 100;
  const initialRenderingMargin = 15;

  const filteredTables = useMemo(() => {
    if (!tables) return null;
    return filterTableCatalog(tables, { search: tableSearch, variableFilters, timeUnitFilter, coverageYearFilter });
  }, [tables, tableSearch, variableFilters, timeUnitFilter, coverageYearFilter]);

  const variableFacetOptions = useMemo(() => aggregateVariableFacets(tables ?? []), [tables]);

  const timeUnitFacetOptions = useMemo(() => aggregateTimeUnitFacets(tables ?? []), [tables]);

  const activeFilterCount = variableFilters.length + (timeUnitFilter ? 1 : 0) + (coverageYearFilter.trim() ? 1 : 0);

  // "Label (code)" of the chosen table, as listed in the catalog. Read from state
  // rather than the list's DOM, which is virtualized and may not hold the row.
  const selectedTableLabel = useMemo(() => {
    const tableId = tableMetadata?.tableId;
    if (!tableId) return "";
    const catalogLabel = tables?.find(table => table.tableId === tableId)?.label ?? tableId;
    return catalogLabel.includes(tableId) ? catalogLabel : `${catalogLabel} (${tableId})`;
  }, [tables, tableMetadata]);

  const hasCoverageFacet = tables?.some(table => table.firstPeriod && table.lastPeriod) ?? false;
  // Catalogs without per-table details (currently Trafa, whose structure listing has
  // no dimensions) have no facets to filter on, so the filter menu is not shown at all.
  const hasAnyFacet = variableFacetOptions.length > 0 || timeUnitFacetOptions.length > 0 || hasCoverageFacet;

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
      .then(result => {
        setTableMetadata(result);
        // The table is already chosen, so open on the selection page
        if (result) setSection(1);
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching initial table metadata:", errorMessage);
        setTableMetadata(null);
      })
      .finally(() => setIsLoading(false));
  }, [dataSource, initialTableId, lang, setTableMetadata, tables]);

  // Run one first query when all metrics already have values without the user touching
  // them — from initial values, or from a single-option metric that was auto-selected.
  // Without this, the variable fieldset (which only unlocks in handleMetricSelect's
  // change handler) would stay disabled forever for single-metric tables.
  useEffect(() => {
    if (!tableMetadata) return;
    if (!(selectorMenuRef.current instanceof HTMLDivElement)) return;

    const metricSelectElements = selectorMenuRef.current.querySelectorAll("select.metric");
    if (metricSelectElements.length === 0) return;

    const hasUnselectedMetric = Array.from(metricSelectElements).some((select) => {
      return select instanceof HTMLSelectElement && !select.value;
    });
    if (hasUnselectedMetric) return;

    // Only dispatch while the variable fieldset is still locked, so later metadata
    // updates (e.g. Trafa's metric-filtered refetches) don't loop back in here.
    const variableFieldsets = Array.from(document?.getElementsByName("variableSelectionFieldset") ?? []);
    if (variableFieldsets.length > 0 && !variableFieldsets.some(fieldset => fieldset.hasAttribute("disabled"))) return;

    const firstMetricSelect = metricSelectElements[0];
    if (firstMetricSelect instanceof HTMLSelectElement) {
      firstMetricSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, [tableMetadata]);

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
    setFilterResetKey(previous => previous + 1);
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
    // Wipe the whole table selection: the old catalog, the metadata and the content.
    // Keeping the old catalog around let the initial-table effect match the preset
    // table id against the previous source's list and fetch it from the new source.
    // The preset table is deliberately not re-applied if the user switches back.
    hasAppliedInitialTableSelectionRef.current = true;
    setTables(null);
    setTableContent(null);
    setTableMetadata(null);
    setSection(0);
  }

  function handleTableSelect(tableId: string) {
    setIsLoading(true);
    setSelectedTableId(tableId);
    setDefaultMetricSelected(true);

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

  function dimensionDisplayLabel(dimension: ApiMetadataDimensionBase) {
    const label = dimension.label || dimension.name;
    if (label === PXWEB_CONTENTS_PLACEHOLDER) return t("components:query_builder.contents_variable");
    return label;
  }

  function metricSelectionHelper(metricDimension: ApiMetadataDimensionBase, tableMetadata: ApiTableMetadata) {
    if (metricDimension.options) {
      // A single-option PxWeb metric is auto-selected, so show it as plain text; the
      // select stays in the DOM (hidden) since queries are built from select values.
      const isAutoSelectedSingle = ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && metricDimension.options.length === 1;
      return (
        <label key={`metric-${tableMetadata.tableId}-${metricDimension.id}`} className="block margin-block-75">
          {dimensionDisplayLabel(metricDimension)}
          {isAutoSelectedSingle ?
            <span className="block margin-block-25" lang={tableMetadata.language}>
              {metricDimension.options[0].label || metricDimension.options[0].value}
            </span>
            : null}
          <select
            style={isAutoSelectedSingle ? { display: "none" } : undefined}
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
            {dimensionDisplayLabel(dimension)}{optionalTag(dataSource, dimension.optional ?? false)}
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

    // Surface the description of each chosen metric next to the data
    setMetricDescriptions((tableMetadata?.metricDimensions ?? []).flatMap(metricDimension => {
      const chosen = metricDimension.options.find(option => option.value === formData.get(metricDimension.id));
      return chosen?.description ? [chosen.description] : [];
    }));

    getTableContent(tableId, dataSource, query, lang).then(result => {
      setTableContent(result);
      // Suggest a reported unit while the user hasn't declared one themselves
      const reportedUnit = result?.unit?.base;
      if (reportedUnit && !unitTouchedRef.current && isMathjsUnit(parseUnit(reportedUnit))) {
        setUnitInput(reportedUnit);
      }
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
        unit: parseUnit(unitInput),
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

      {isPortalMounted ? createPortal(
      <dialog className={`rounded padding-inline-0 padding-block-0 ${styles.dialog} ${styles.builder}`} ref={modalRef} aria-modal={true} style={{ backgroundColor: 'rgb(246, 246, 246)' }}>
        <div className={`${styles['dialog-content']}`}>
          <div className={`${styles['dialog-header']}`}>
            <button type="button" className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus={true} aria-label={t("common:tsx.close")} >
              <IconX strokeWidth={3} width={28} height={28} style={{ minWidth: '28px' }} aria-hidden="true" />
            </button>
            <h2 className="margin-0">{t("components:query_builder.add_data_source")}</h2>
          </div>

          <div className={`${styles['dialog-panes']}`}>
            <div className={`${styles['dialog-pane']} ${styles['dialog-pane-form']}`}>
            <FormWrapper section={section} labels={{ back: t("components:query_builder.change_table") }}>
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

                    {hasAnyFacet ? <details className="margin-bottom-25 smooth purewhite padding-50" style={{ border: "1px solid var(--gray-80)" }}>
                      <summary className="font-weight-500" style={{ cursor: "pointer" }}>
                        {t("components:query_builder.filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                      </summary>

                      {variableFacetOptions.length > 0 ?
                        <>
                          <label htmlFor="tableVariableFilter" className="block margin-top-50">{t("components:query_builder.filter_by_variable")}</label>
                          <SelectMultipleSearch
                            key={`variable-filter-${dataSource}-${lang}-${filterResetKey}`}
                            props={{
                              id: "tableVariableFilter",
                              name: "tableVariableFilter",
                              className: "margin-block-25",
                              placeholder: t("components:query_builder.any_variable"),
                            }}
                            options={variableFacetOptions.map(({ key, name, count }) => ({ name: `${name} (${count})`, value: key }))}
                            onChange={value => {
                              setVariableFilters((value ?? []).map(option => option.value));
                              setOffset(0);
                            }}
                          />
                        </>
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

                      {hasCoverageFacet ?
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
                    </details> : null}

                    {tables && filteredTables ?
                      <p className="margin-block-25 font-size-14px color-gray">
                        {t("components:query_builder.showing_table_count", { shown: filteredTables.length, total: tables.length })}
                      </p>
                      : null}

                    <ul
                      id="tablesList"
                      className={`position-relative padding-25 smooth purewhite ${styles.scrollable}`} onScroll={e => handleTableListScroll(e)}
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
                <label className={`block ${styles['selected-table-heading']}`}>
                  <Trans
                    i18nKey={"components:query_builder.selected_table"}
                    values={{ table: selectedTableLabel }}
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
                <fieldset name="variableSelectionFieldset" disabled={true} className={`margin-block-100 smooth padding-25 fieldset-unset-pseudo-class`} style={{ border: `${shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? "1px solid var(--gray-90)" : ""}` }}>
                  {shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? (
                    <>
                      <legend className="padding-inline-50">
                        <b>{t("components:query_builder.select_values_for_table")}</b>
                      </legend>
                      <div className="padding-25">
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
            </div>

            <div className={`${styles['dialog-pane']} ${styles['dialog-preview']}`}>
            <output className="block">
              {tableContent && tableContent.values.length > 0 ? (
                <div>
                  <p className="margin-top-0">{t("components:query_builder.does_this_look_correct")}</p>
                  {/* Everything that came back from the API lives in this card: the table as
                      listed on the left (label and code), what the selection resolved to, and the values */}
                  <div className={styles['preview-card']}>
                  <p className="margin-top-0 font-weight-500">{t("components:query_builder.fetched_data")}</p>
                  {(() => {
                    const tableLabel = selectedTableLabel || tableContent.id;
                    // Some sources (Trafa) only report the table name here, which the line above already shows
                    const selectionLabels = tableContent.metadata
                      .map(item => item.label)
                      .filter((label): label is string => !!label && !tableLabel.includes(label));
                    return (<>
                      <p className="font-weight-500">{tableLabel}</p>
                      {selectionLabels.length > 0 ? <p>{selectionLabels.join(", ")}</p> : null}
                      {metricDescriptions.map(description => (
                        <p key={description} className="font-style-italic">{description}</p>
                      ))}
                      {tableContent.unit?.base ?
                        <p>{t("components:query_builder.reported_unit")}: {tableContent.unit.base}</p>
                        : null}
                    </>);
                  })()}
                  <table className={styles['preview-table']}>
                    <thead>
                      <tr>
                        <th scope="col">{t("components:query_builder.period")}</th>
                        <th scope="col">{t("components:query_builder.value")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {
                        tableContent.values.map(({ period, value }) => (
                          <tr key={period}>
                            <td>{period}</td>
                            <td>{value}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : !defaultMetricSelected ? (
                <p className="margin-0">{t("components:query_builder.no_result_found")}</p>
              ) : (
                <p className="margin-0 font-style-italic color-gray">{t("components:query_builder.preview_placeholder")}</p>
              )}
            </output>

            {/* Unit of the fetched data, declared by the user (the APIs rarely state it) and saved onto the variable */}
            {tableMetadata ?
              <div className="margin-top-100">
                <label htmlFor={`external-unit-${variableId}`} className="block font-weight-500">
                  {t("components:recipe_editor.unit_placeholder")}
                </label>
                <TextSingleAutocomplete
                  props={{
                    id: `external-unit-${variableId}`,
                    name: `external-unit-${variableId}`,
                    className: "margin-block-25",
                    style: { width: "100%" },
                  }}
                  options={allOurUnits.map(unit => ({ name: unit, value: unit }))}
                  value={unitInput}
                  setter={(next) => {
                    unitTouchedRef.current = true;
                    setUnitInput(next);
                  }}
                />
                <small className="block color-gray">{t("components:query_builder.unit_help")}</small>
              </div>
              : null}
            </div>
          </div>

          <div className={`${styles['dialog-footer']}`}>
            <button
              type="button"
              className="seagreen color-purewhite block width-100"
              onClick={() => saveRecipe()}
            >
              {t("components:query_builder.add_data_source_button")}
            </button>
          </div>
        </div>
      </dialog>,
      document.body,
      ) : null}
    </>
  );
}