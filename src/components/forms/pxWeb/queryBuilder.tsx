'use client';

import { closeModal, openModal } from "@/components/modals/modalFunctions";
import formSubmitter from "@/functions/formSubmitter";
import { ApiTableContent, ApiTableDetails } from "@/lib/api/apiTypes";
import { getPxWebTableContent } from "@/lib/pxWeb/getPxWebTableContent";
import { getPxWebTableDetails } from "@/lib/pxWeb/getPxWebTableDetails";
import { getPxWebTables } from "@/lib/pxWeb/getPxWebTables";
import { externalDatasetBaseUrls } from "@/lib/pxWeb/utility";
import { Goal } from "@prisma/client";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import FormWrapper from "../formWrapper";
import styles from './queryBuilder.module.css';

export default function QueryBuilder({
  goal,
}: {
  goal: Goal,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<string>("" as keyof typeof externalDatasetBaseUrls);
  const [tables, setTables] = useState<{ tableId: string, label: string }[] | null>(null);
  const [tableDetails, setTableDetails] = useState<ApiTableDetails | null>(null);
  const [tableContent, setTableContent] = useState<ApiTableContent | null>(null);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const tableSearchInputName = "tableSearch";

  useEffect(() => {
    if (!dataSource) return;

    const query = (formRef.current?.elements.namedItem(tableSearchInputName) as HTMLInputElement | null)?.value;

    getPxWebTables(dataSource, query).then(result => setTables(result));
  }, [dataSource]);

  function buildQuery(formData: FormData) {
    const queryObject: object[] = []
    formData.forEach((value, key) => {
      // Skip empty values
      if (!value) return;
      // Skip externalDataset, externalTableId, and `tableSearchInputName`, as they are not part of the query
      if (key == "externalDataset") return;
      if (key == "externalTableId") return;
      if (key == tableSearchInputName) return;
      // The time variable is special, as we want to fetch every period after (and including) the selected one
      if (key == formRef.current?.getElementsByClassName("TimeVariable")[0]?.id) {
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
    if (!tables || !tableDetails) return;
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
      externalTableId: formData.get("externalTableId") as string,
      externalSelection: query,
      timestamp: Date.now(),
    }), "PUT", setIsLoading);
  }

  function tryGetResult() {
    if (!(formRef.current instanceof HTMLFormElement)) return;
    if (!tables) return;
    if (!tableDetails) return;

    if (formRef.current.checkValidity()) {
      const formData = new FormData(formRef.current);
      const query = buildQuery(formData);
      getPxWebTableContent(formData.get("externalTableId") as string ?? "", query, dataSource).then(result => setTableContent(result));
    }
  }

  function searchOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
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
    if (!externalDatasetBaseUrls[dataSource as keyof typeof externalDatasetBaseUrls]) return;

    getPxWebTables(dataSource, query).then(result => setTables(result));
  }

  function handleSelect(tableId: string) {
    if (!externalDatasetBaseUrls[dataSource as keyof typeof externalDatasetBaseUrls]) return;
    if (!tableId) return;

    getPxWebTableDetails(tableId, dataSource).then(result => setTableDetails(result));
  }

  return (
    <>
      <button type="button" className="transparent flex align-items-center gap-25 font-weight-500" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} onClick={() => openModal(modalRef)}>
        Lägg till historisk data
        <Image src='/icons/chartAdd.svg' alt="" width={16} height={16} />
      </button>
      <dialog className={`smooth${styles.dialog}`} ref={modalRef} aria-modal style={{ border: '0', boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25' }}>
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between`}>
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label="Close" >
            <Image src='/icons/close.svg' alt="" width={18} height={18} />
          </button>
          <h2 className="margin-0">Lägg till datakälla</h2>
        </div>
        <p>Lägg till en historisk dataserie till {goal.name ?? goal.indicatorParameter}</p>

        <form ref={formRef} onChange={tryGetResult} onSubmit={handleSubmit}>
          {// Hidden disabled submit button to prevent accidental submisson
          }
          <button type="submit" className="display-none" disabled></button>

          <FormWrapper>
            <fieldset>
              <label className="margin-block-75">
                Datakälla
                <select className="block margin-block-25" required name="externalDataset" id="externalDataset" onChange={e => setDataSource(e.target.value)}>
                  <option value="">Välj en källa</option>
                  {Object.keys(externalDatasetBaseUrls).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
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
                    <button type="button" onClick={searchWithButton} style={{ fontSize: '1rem' }}>Sök</button>
                  </div>

                  <div className="padding-25 smooth" style={{ border: '1px solid var(--gray-90)' }}>
                    <div className={styles.temporary}>
                      {tables && tables.map(({ tableId: id, label }) => (
                        <label key={id} className={`${styles.tableSelect} block padding-block-25`}>
                          {label}
                          <input type="radio" value={id} name="externalTableId" onChange={e => handleSelect(e.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
                : null}
            </fieldset>

            {tableDetails && (
              <>
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: '1px solid var(--gray-90)' }}>
                  <legend className="padding-inline-50">
                    <strong>Välj mätvärde för tabell</strong>
                  </legend>
                  <label key="metric" className="block margin-block-75">
                    <select className={`block margin-block-25 metric`}
                      required={true}
                      name="metric"
                      id="metric"
                      defaultValue={tableDetails.metrics && tableDetails.metrics.length == 1 ? tableDetails.metrics[0].label : undefined}>
                      {
                        tableDetails.metrics && tableDetails.metrics.length != 1 &&
                        <option value="">Välj mätvärde</option>
                      }
                      {tableDetails.metrics && tableDetails.metrics.map(metric => (
                        <option key={metric.name} value={metric.name} lang={tableDetails.language}>{metric.label}</option>
                      ))}
                    </select>


                  </label>
                </fieldset>
                <fieldset className="margin-block-100 smooth padding-50" style={{ border: '1px solid var(--gray-90)' }}>
                  <legend className="padding-inline-50">
                    <strong>Välj värden för tabell</strong>
                  </legend>
                  {tableDetails.times.length > 1 &&
                    <label key="Tid" className="block margin-block-75">
                      Välj starttid
                      <select className={`block margin-block-25 TimeVariable`}
                        required={false}
                        name="Tid"
                        id="Tid"
                        defaultValue={tableDetails.times && tableDetails.times.length == 1 ? tableDetails.times[0].label : undefined}>
                        <option value="">Välj tidsperiod</option>
                        {tableDetails.times.map(time => (
                          <option key={time.name} value={time.name} lang={tableDetails.language}>{time.id}</option>
                        ))}
                      </select>
                    </label>
                  }
                  {tableDetails.variables.map(variable => {
                    if (variable.option) return (
                      <label key={variable.name} className="block margin-block-75">
                        {variable.label[0].toUpperCase() + variable.label.slice(1)}
                        {// Use CSS to set proper capitalisation of labels; something like `label::first-letter { text-transform: capitalize; }`}
                        }
                        <select className={`block margin-block-25 ${variable.label}`}
                          required={!variable.optional}
                          name={variable.name}
                          id={variable.name}
                          // If only one value is available, pre-select it
                          defaultValue={variable.values && variable.values.length == 1 ? variable.values[0].label : undefined}>
                          { // If only one value is available, don't show a placeholder option
                            variable.values && variable.values.length > 1 &&
                            <option value="">Välj värde</option>
                          }
                          {variable.values && variable.values.map(value => (
                            <option key={value.label} value={value.name} lang={tableDetails.language}>{value.label}</option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
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
                    })
                  }
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <p>Inget läsbart resultat hittades. Vänligen uppdatera dina val.</p>
            </div>
          )}

          <button type="submit" className="seagreen color-purewhite">Lägg till datakälla</button>
        </form>
      </dialog>
    </>
  )
}