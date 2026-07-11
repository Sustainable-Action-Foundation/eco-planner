import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import getTableContent from "@/lib/api/getTableContent";
import getTableMetadata from "@/lib/api/getTableMetadata";
import getTables from "@/lib/api/getTables";
import { formQueryHelper, ExternalDataset } from "@/lib/api/utility";
import { LocaleContext } from "@/lib/i18nClient";
import type { Goal } from "@/types";
import { useContext, useCallback, useRef, useEffect, useMemo, useReducer } from "react";
import type { SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import { getInitialSelectionValue, shouldVariableFieldsetBeVisible, metricSelectionHelper, optionalTag, timeVariableSelectionHelper, variableSelectionHelper, externalDataReducer } from "./helpers";
import type { ExternalData, ExternalDataState } from "@/components/types";

// TODO: Maybe this should not be in /api
// TODO: Take in required as a prop?

export type ExternalSelection = NonNullable<Parameters<typeof getTableMetadata>[2]>;

export default function ExternalData({
  goal,
  onChange,
}: {
  goal: Goal | undefined,
  onChange?: (data: ExternalDataState) => void;
}) {

  const { t } = useTranslation("components");
  // Locale has the format language-REGION, e.g. "sv-SE" or "en-US", we only need the language part
  const lang = new Intl.Locale(useContext(LocaleContext)).language;

  const historicalSource = useMemo(
    () => (goal ? getHistoricalSource(goal) : null),
    [goal],
  );
  const historicalSelection: ExternalSelection = useMemo(
    () => historicalSource?.selection ?? [],
    [historicalSource],
  );

  const initialState: ExternalData = {
    dataSource: historicalSource?.dataset ?? "",
    table: historicalSource?.tableId
      ? { label: historicalSource.tableId, tableId: historicalSource.tableId }
      : null,
    tables: null,
    tableMetadata: null,
    tableContent: null,
    mainTimeDimensionId: null,
  };

  const [state, dispatch] = useReducer(externalDataReducer, initialState);
  const { dataSource, table, tables, tableMetadata, tableContent, mainTimeDimensionId } = state;
  const datasetInfo = useMemo(
    () => ExternalDataset.getDatasetByAlternateName(dataSource),
    [dataSource],
  );
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  // eslint-disable-next-line react-hooks/refs
  onChangeRef.current = onChange;
  const didInitialLoadRef = useRef(false);

  // Reads the current form state out of the DOM and turns it into a query,
  // Also checks if the form is currently valid.
  const buildQuery = useCallback(() => {
    if (!sectionRef.current) return null;

    const elements = sectionRef.current.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input");
    const isValid = Array.from(elements).every(el => el.checkValidity());

    const nativeFormData = new FormData();
    elements.forEach(el => {
      if (el.name) nativeFormData.append(el.name, el.value);
    });

    const query = formQueryHelper(nativeFormData, tableMetadata, mainTimeDimensionId);

    return { query, isValid };
  }, [tableMetadata, mainTimeDimensionId]);


  const refreshTrafaMetadata = useCallback((
    event: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event | undefined,
    query: ReturnType<typeof formQueryHelper>,
  ) => {
    if (dataSource !== "Trafa" || !table) return;

    const changedSelect = event?.target instanceof HTMLSelectElement ? event.target : null;
    if (!changedSelect) return;

    const isRelevantChange =
      tableMetadata?.metricDimensions.some(metricDimension => metricDimension.id === changedSelect.name)
      || tableMetadata?.regularDimensions.some(variable => variable.id === changedSelect.name)
      || tableMetadata?.timeDimensions.some(variable => variable.id === changedSelect.name)
      || tableMetadata?.hierarchies?.some(hierarchy => hierarchy.children.some(child => child.id === changedSelect.name));

    if (!isRelevantChange) return;

    void getTableMetadata(table.tableId, dataSource, query, lang).then(metadata => {
      dispatch({ type: "SET_METADATA", metadata });
    });
  }, [dataSource, table, tableMetadata, lang]);

  // Fetches table content for the current query, or clears it if the form
  // isn't currently valid.
  const fetchContent = useCallback((query: ReturnType<typeof formQueryHelper>, isValid: boolean) => {
    if (!isValid) {
      dispatch({ type: "SET_CONTENT", content: null });
      return;
    }

    getTableContent(table ? table.tableId : "", dataSource, query, lang)
      .then(result => {
        dispatch({ type: "SET_CONTENT", content: result });
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Error fetching table content:", errorMessage);
        dispatch({ type: "SET_CONTENT", content: null });
      });
  }, [dataSource, lang, table]);

  const tryGetResult = useCallback((event?: React.ChangeEvent<HTMLSelectElement> | SubmitEvent<HTMLFormElement> | Event) => {
    const result = buildQuery();
    if (!result) return;

    const { query, isValid } = result;

    refreshTrafaMetadata(event, query);
    fetchContent(query, isValid);
  }, [buildQuery, refreshTrafaMetadata, fetchContent]);

  useEffect(() => {
    onChangeRef.current?.({ dataSource, table, tables, tableMetadata, tableContent, mainTimeDimensionId });
  }, [dataSource, table, tables, tableMetadata, tableContent, mainTimeDimensionId]);

  const initialTableId = historicalSource?.tableId ?? null;
  useEffect(() => {
    if (!table || !dataSource || !datasetInfo?.baseUrl) return;

    const isInitialLoad = !didInitialLoadRef.current && table.tableId === initialTableId;
    didInitialLoadRef.current = true;

    let cancelled = false;
    void getTableMetadata(
      table.tableId,
      dataSource,
      isInitialLoad ? historicalSelection : undefined,
      lang,
    ).then(metadata => {
      if (!cancelled) dispatch({ type: "SET_METADATA", metadata });
    });

    return () => { cancelled = true; };

  }, [table, table?.tableId, dataSource, datasetInfo?.baseUrl, lang, initialTableId, historicalSelection]);

  useEffect(() => {
    if (!sectionRef.current || !tableMetadata) return;
    tryGetResult();
  }, [tableMetadata, tryGetResult]);

  useEffect(() => {
    if (!dataSource) return;

    void getTables(dataSource, lang).then(result => {
      dispatch({ type: "SET_TABLES", tables: result });
    });
  }, [dataSource, lang]);

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
          {(datasetInfo && !(datasetInfo?.supportedLanguages.includes(lang))) ?
            <small className="font-weight-normal font-style-italic margin-left-50" style={{ color: "red" }}>
              {t("components:query_builder.language_support_warning", { dataSource: dataSource })}
            </small>
            : null}
          <select
            defaultValue={historicalSource?.dataset ?? ''}
            className="block margin-top-25 margin-bottom-100 width-100"
            required={true}
            name="externalDataset"
            id="externalDataset"
            onChange={e => dispatch({ type: "SELECT_DATASET", dataSource: e.target.value })}>
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
          onChange={(value) => dispatch({
            type: "SELECT_TABLE",
            table: value?.value ? { tableId: value.value, label: value.name } : null,
          })} />
      </fieldset>

      <fieldset className="width-100 margin-top-200 min-width-0">
        <legend className="padding-block-125 font-weight-bold">
          {t("components:query_builder.select_metric_for_table")}
        </legend>
        {table && tableMetadata ? (
          // eslint-disable-next-line react-hooks/refs
          tableMetadata.metricDimensions?.map((metricDimension) => (
            metricSelectionHelper({
              t,
              metricDimension,
              tableMetadata,
              dataSource,
              historicalSelection,
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
          shouldVariableFieldsetBeVisible(tableMetadata, datasetInfo) ? (
          <div>
            {/* eslint-disable-next-line react-hooks/refs */}
            {tableMetadata.timeDimensions?.map(time => {
              return timeVariableSelectionHelper({
                t,
                language: tableMetadata.language,
                time: time,
                dataSource,
                datasetInfo,
                historicalSelection,
                optionalTag,
                tryGetResult,
                getInitialSelectionValue,
              });
            })}

            {/* eslint-disable-next-line react-hooks/refs */}
            {tableMetadata.regularDimensions.map(variable => {
              return variableSelectionHelper({
                t,
                dimension: variable,
                tableMetadata,
                historicalSelection,
                dataSource,
                datasetInfo,
                optionalTag,
                tryGetResult,
              });
            })}

            {/* eslint-disable-next-line react-hooks/refs */}
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
                        datasetInfo,
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