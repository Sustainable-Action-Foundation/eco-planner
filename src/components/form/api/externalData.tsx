import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import type { ApiTableMetadata, ApiTableContent } from "@/lib/api/apiTypes";
import getTableContent from "@/lib/api/getTableContent";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { formQueryHelper, ExternalDataset } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { Goal } from "@/types";
import { useContext, useState, useCallback, useRef, useEffect } from "react";
import type { SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { metricSelectionHelper, timeVariableSelectionHelper, variableSelectionHelper } from "./helpers";

// TODO: Maybe this should not be in /api
// TODO: Take in required as a prop?

export type ExternalSelection = NonNullable<Parameters<typeof getTableMetadata>[2]>;

export default function ExternalData({
  goal,
  onChange,
}: {
  goal: Goal,
  onChange?: (data: {
    dataSource: string;
    table: { tableId: string; label: string } | null;
    tableMetadata: ApiTableMetadata | null;
    tableContent: ApiTableContent | null;
    mainTimeDimensionId: string | null;
  }) => void;
}) {

  const { t } = useTranslation("components");
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;

  // The external API selection is stored in the goal's historical recipe; the
  // fetched values live in the `historical` DataSeries.
  const historicalSource = goal ? getHistoricalSource(goal) : null;
  const historicalSelection: ExternalSelection = historicalSource?.selection ?? [];

  const [dataSource, setDataSource] = useState<string>(historicalSource?.dataset ?? "");
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null); // TODO: Rename to something like: AvailableTables, or the below to something like: selected table, to avoid confusion
  const [table, setTable] = useState<{ tableId: string, label: string } | null>(historicalSource?.tableId ? { label: tables?.find(t => t.tableId === historicalSource.tableId)?.label ?? historicalSource.tableId, tableId: historicalSource.tableId } : null);

  const [tableMetadata, _setTableMetadata] = useState<ApiTableMetadata | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);
  const [mainTimeDimensionId, setMainTimeDimensionId] = useState<string | null>(null);

  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onChange?.({ dataSource, table, tableMetadata, tableContent, mainTimeDimensionId });
  }, [dataSource, table, tableMetadata, tableContent, mainTimeDimensionId, onChange]);

  function getInitialSelectionValue(variableCode: string) {
    const valueCode = historicalSelection.find(selection => selection.variableCode === variableCode)?.valueCodes?.[0];
    if (!valueCode) return undefined;

    const fromMatch = /^FROM\((.+)\)$/i.exec(valueCode);
    return fromMatch?.[1] ?? valueCode;
  }

  const setTableMetadata = useCallback((tableMetadata: ApiTableMetadata | null) => {
    _setTableMetadata(prev => {
      if (!tableMetadata) {
        // if no metadata, reset the main time dimension id to null
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
    if (!sectionRef.current) return;

    const elements = sectionRef.current.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input");
    const isValid = Array.from(elements).every(el => el.checkValidity());
    const nativeFormData = new FormData();
    elements.forEach(el => {
      if (el.name) nativeFormData.append(el.name, el.value);
    });

    // TODO: Check if this is stupid to do before validating elements?
    const query = formQueryHelper(nativeFormData, tableMetadata, mainTimeDimensionId);

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

    if (isValid) {
      getTableContent(table ? table.tableId : "", dataSource, query, lang).then(result => {
        setTableContent(result);
      }).catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table content:", errorMessage);
        setTableContent(null);
      });
    } else {
      setTableContent(null);
    }
  }, [dataSource, lang, mainTimeDimensionId, setTableMetadata, tableMetadata, table]);


  // 1. Fetch table details
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
    // TODO: why do we disable eslint here?
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTableId, initialDataset, lang, setTableMetadata]);

  // 2. Fetch table content
  useEffect(() => {
    if (!sectionRef.current || !tableMetadata) return;
    tryGetResult();
  }, [tableMetadata, tryGetResult]);

  useEffect(() => {
    if (!dataSource) return;

    // TODO: Undefined here is query, we likely want to remove it once this is all set ut and queryBuilder.tsx is removed
    void getTables(dataSource, undefined, lang).then(result => {
      setTables(result);
    });
  }, [dataSource, lang]);

  {/* TODO: See if we can remove table content when de-selecting  */ }
  const handleTableSelect = useCallback((tableId: string | null) => {
    if (!ExternalDataset.getDatasetByAlternateName(dataSource)?.baseUrl) return;
    if (!tableId) return;
    setTableContent(null);
    setTableMetadata(null);

    void getTableMetadata(tableId, dataSource, undefined, lang).then(result => {
      setTableMetadata(result);
    });
  }, [dataSource, lang, setTableMetadata]);

  useEffect(() => {
    handleTableSelect(!!table?.tableId ? table.tableId : null);
  }, [table, handleTableSelect]);

  // TODO: should probably use a pseudo class (::after) instead of a span here.
  function optionalTag(dataSource: string, variableIsOptional: boolean | null | undefined) {
    if (ExternalDataset.getDatasetByAlternateName(dataSource)?.api === "PxWeb" && variableIsOptional) {
      return (
        <span className={`font-style-italic color-gray`}> - ({t("components:query_builder.optional")})</span>
      );
    }
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

  return (
    <div ref={sectionRef}>
      <fieldset
        className="width-100 min-width-0"
      >
        <legend className="padding-block-125 font-weight-bold">
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

      <fieldset className="width-100 margin-top-200 min-width-0">
        <legend className="padding-block-125 font-weight-bold">
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

      <fieldset className="width-100 margin-top-200 min-width-0">
        <legend className="padding-block-125 font-weight-bold">
          {t("components:query_builder.select_values_for_table")}
        </legend>

        {tableMetadata &&
          shouldVariableFieldsetBeVisible(tableMetadata, dataSource) ? (
          <div>

            {tableMetadata.timeDimensions?.map(time => {
              return timeVariableSelectionHelper({
                t,
                language: tableMetadata.language,
                time: time,
                dataSource,
                optionalTag,
                tryGetResult,
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
          <p className="font-style-italic color-gray margin-0 margin-bottom-100">
            {t("components:query_builder.no_variables_found")}
          </p>
        )
        }
      </fieldset>
    </div>
  );
}