'use client';

import { useEffect, useState } from "react";
import { ScaleBy } from "@/types";
import areaCodes from "@/lib/areaCodes.json" with { type: "json" };
import scbPopulationQuery from "@/lib/scbPopulationQuery";
import scbAreaQuery from "@/lib/scbAreaQuery";
import { areaSorter } from "@/lib/sorters";
import { validateDict, useClientLocale } from "@/functions/clientLocale";
import dict from "./repeatableScaling.dict.json" assert { type: "json" };

/** Get values from SCB */
async function getValue(e: React.ChangeEvent<HTMLSelectElement> | { target: { value: string } }, scaleBy: ScaleBy | "") {
  const areaCode = e.target.value;
  let value: number | null = null;
  if (!areaCode) {
    return null;
  }
  switch (scaleBy) {
    case ScaleBy.Inhabitants:
      value = parseFloat((await scbPopulationQuery(areaCode))?.population ?? "0");
      return value;
    case ScaleBy.Area:
      value = parseFloat((await scbAreaQuery(areaCode))?.area ?? "0");
      return value;
    default:
      return null;
  }
};

/**
 * A repeatable component for scaling data based on area or inhabitants.
 * Should be used in a form, and the combined output can be read from the hidden input(-s) named "scaleFactor".
 * 
 * With multiple `RepeatableScaling`s with default areas, some value fetches may fail with `TypeError: fetch failed`, but this probably only happens in development builds.
 */
export default function RepeatableScaling({
  children,
  defaultScaleBy,
  defaultParentArea,
  defaultChildArea,
  defaultSpecificValue,
  useWeight = true,
}: {
  children?: React.ReactNode
  defaultScaleBy?: ScaleBy,
  defaultParentArea?: string,
  defaultChildArea?: string,
  defaultSpecificValue?: number,
  useWeight?: boolean
}) {
  validateDict(dict);
  const locale = useClientLocale();

  const [scaleBy, setScaleBy] = useState<ScaleBy | "">(defaultScaleBy ?? "");
  const [numericInput, setNumericInput] = useState<number | null>(null);
  const [parentValue, setParentValue] = useState<number | null>(null);
  const [childValue, setChildValue] = useState<number | null>(null);

  // Set parentValue on mount and when scaleBy changes
  useEffect(() => {
    if (defaultParentArea) {
      getValue({ target: { value: defaultParentArea } }, scaleBy).then(value => setParentValue(value));
    } else {
      setParentValue(null);
    }
  }, [defaultParentArea, scaleBy]);

  // Set childValue on mount and when scaleBy changes
  useEffect(() => {
    if (defaultChildArea) {
      getValue({ target: { value: defaultChildArea } }, scaleBy).then(value => setChildValue(value));
    } else {
      setChildValue(null);
    }
  }, [defaultChildArea, scaleBy]);

  // Set numericInput on mount
  useEffect(() => {
    setNumericInput(defaultSpecificValue ?? null);
  }, [defaultSpecificValue]);

  let result: number | null = null;
  switch (scaleBy) {
    case ScaleBy.Area:
    case ScaleBy.Inhabitants:
      result = (parentValue && childValue) ? (childValue / parentValue) : null;
      break;
    case ScaleBy.Custom:
      result = numericInput;
      break;
    default:
      result = null;
  }

  function ScalarInputs() {
    switch (scaleBy) {
      case ScaleBy.Custom:
        return (
          <div key={ScaleBy.Custom}>
            <label htmlFor="specificValue">{dict.scaleFactor[locale]}</label>
            <input required type="number" step="any" name="specificValue" id="specificValue" defaultValue={defaultSpecificValue} onChange={(e) => setNumericInput(parseFloat(e.target.value))} />
          </div>
        );
      case ScaleBy.Inhabitants:
        return (
          <div key={ScaleBy.Inhabitants}>
            <section className="margin-block-50">
              <label className="flex align-items-center justify-content-space-between">
                {dict.originalLocation[locale]}
                <select required name="parentArea" id="parentArea" defaultValue={defaultParentArea} onChange={(e) => { getValue(e, scaleBy).then((result) => setParentValue(result)) }}>
                  <option value="">{dict.chooseLocation[locale]}</option>
                  {
                    Object.entries(areaCodes).sort(areaSorter).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))
                  }
                </select>
              </label>

              <label>
                <small className="flex gap-25">
                  {dict.numberOfResidents[locale]}
                  <output name="parentAreaPopulation" id="parentAreaPopulation">{parentValue ?? dict.missingData[locale]}</output>
                </small>
              </label>
            </section>

            <section className="margin-block-50">
              <label className="flex align-items-center justify-content-space-between">
                {dict.newLocation[locale]}
                <select required name="childArea" id="childArea" defaultValue={defaultChildArea ?? ""} onChange={(e) => { getValue(e, scaleBy).then((result) => setChildValue(result)) }}>
                  <option value="">{dict.chooseLocation[locale]}</option>
                  {
                    Object.entries(areaCodes).sort(areaSorter).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))
                  }
                </select>
              </label>

              <label>
                <small className="flex gap-25">
                  {dict.numberOfResidents[locale]}
                  <output name="childAreaPopulation" id="childAreaPopulation">{childValue ?? dict.missingData[locale]}</output>
                </small>
              </label>
            </section>
          </div>
        );
      case ScaleBy.Area:
        return (
          <div key={ScaleBy.Area}>
            <section className="margin-block-50">
              <label className="flex align-items-center justify-content-space-between">
                {dict.originalLocation[locale]}
                <select required name="parentArea" id="parentArea" defaultValue={defaultParentArea ?? ""} onChange={(e) => { getValue(e, scaleBy).then((result) => setParentValue(result)) }}>
                  <option value="">{dict.chooseLocation[locale]}</option>
                  {
                    Object.entries(areaCodes).sort(areaSorter).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))
                  }
                </select>
              </label>

              <label>
                <small className="flex gap-25">
                  {dict.surfaceArea[locale]}
                  <output name="parentAreaArea" id="parentAreaArea">{parentValue ? `${parentValue} ${dict.squareKilometers[locale]}` : dict.missingData[locale]}</output>
                </small>
              </label>
            </section>

            <section className="margin-block-50">
              <label className="flex align-items-center justify-content-space-between">
                {dict.newLocation[locale]}
                <select required name="childArea" id="childArea" defaultValue={defaultChildArea ?? ""} onChange={(e) => { getValue(e, scaleBy).then((result) => setChildValue(result)) }}>
                  <option value="">{dict.chooseLocation[locale]}</option>
                  {
                    Object.entries(areaCodes).sort(areaSorter).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))
                  }
                </select>
              </label>

              <label>
                <small className="flex gap-25">
                  {dict.surfaceArea[locale]}
                  <output name="childAreaArea" id="childAreaArea">{childValue ? `${childValue} ${dict.squareKilometers[locale]}` : dict.missingData[locale]}</output>
                </small>
              </label>
            </section>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="flex gap-50 align-items-center padding-inline-50">
          {dict.scaleBy[locale]}
          <select className="block margin-block-25" required name="scaleBy" id="scaleBy" defaultValue={defaultScaleBy} onChange={(e) => setScaleBy(e.target.value as ScaleBy)}>
            <option value="">{dict.noSelectionMade[locale]}</option>
            <option value={ScaleBy.Custom}>{dict.specificValue[locale]}</option>
            <option value={ScaleBy.Inhabitants}>{dict.inRelationToPopulation[locale]}</option>
            <option value={ScaleBy.Area}>{dict.inRelationToSurfaceArea[locale]}</option>
          </select>
        </legend>

        {ScalarInputs()}

        <label className="block margin-block-75">
          {`${dict.scaleFactorCalculation[locale]} `} <br />
          <output name="result" id="result">{Number.isFinite(result ?? NaN) ? result : dict.missingData[locale]}</output>
        </label>

        {/* Hidden input, used because outputs are not submitted with formData */}
        <input className="margin-block-25" type="hidden" name="scaleFactor" value={(Number.isFinite(result ?? 1) && result?.toString()) ? result.toString() : "1"} />
  
        {// Only show weight input if useWeight is true
          useWeight &&
          <>
            <label className="block margin-block-75">
              {dict.weightFactor[locale]}
              <input className="margin-block-25" type="number" step={"any"} min={0} id="weight" name="weight" defaultValue={1} />
            </label>
          </>
        }

        {children &&
          <>
            {children}
          </>
        }
      </fieldset>
    </>
  )
}