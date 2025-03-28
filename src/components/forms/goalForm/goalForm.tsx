'use client';

import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import Image from "next/image";
import { GoalInput, ScaleBy, ScaleMethod, ScalingRecipie, dataSeriesDataFieldNames, isScalingRecipie } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import /* LinkInput, */ LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput";
import formSubmitter from "@/functions/formSubmitter";
import { useEffect, useMemo, useState } from "react";
import { CombinedGoalForm, InheritedGoalForm, InheritingBaseline, ManualGoalForm } from "./goalFormSections";
import RepeatableScaling from "@/components/repeatableScaling";
import { getScalingResult } from "@/components/modals/copyAndScale";
import mathjs from "@/math";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import styles from '../forms.module.css'

enum DataSeriesType {
  Static = "STATIC",
  Inherited = "INHERIT",
  Combined = "COMBINE",
}

enum BaselineType {
  Initial = "INITIAL",
  Custom = "CUSTOM",
  Inherited = "INHERIT",
}

// The amount of years in the data series
const dataSeriesLength = dataSeriesDataFieldNames.length
/**
 * This matches 0 to `dataSeriesLength` numbers separated by tabs or semicolons, with an optional decimal part.
 * The first position represents the value for the first year (currently 2020), and any number in the `dataSeriesLength`:th position
 * represents the value for the last year (currently 2050).
 * 
 * Two examle strings that match this pattern are:  
 * "2.0;2.1;2.2;2.3;2.4;2.5;2.6;2.7;2.8;2.9;3.0;3.1;3.2;3.3;3.4;3.5;3.6;3.7;3.8;3.9;4.0;4.1;4.2;4.3;4.4;4.5;4.6;4.7;4.8;4.9;5.0"  
 * and  
 * ";0;;;4;1"
 */
export const dataSeriesPattern = `(([0-9]+([.,][0-9]+)?)?[\t;]){0,${dataSeriesLength - 1}}([0-9]+([.,][0-9]+)?)?`;

export default function GoalForm({
  roadmapId,
  roadmapAlternatives,
  currentGoal,
}: {
  roadmapId?: string,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    baselineDataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        id: string,
        dataSeries: DataSeries | null,
        roadmapId: string,
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(!currentGoal?.combinationParents.length ? DataSeriesType.Static : currentGoal.combinationParents.length >= 2 ? DataSeriesType.Combined : DataSeriesType.Inherited)
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baselineDataSeries ? BaselineType.Custom : BaselineType.Initial)
  const [scalingRecipie, setScalingRecipe] = useState<ScalingRecipie>({ values: [] });
  const [scalingResult, setScalingResult] = useState<number | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(currentGoal?.roadmapId || roadmapId || "");

  useEffect(() => {
    try {
      const parsed = JSON.parse(currentGoal?.combinationScale ?? "")
      if (isScalingRecipie(parsed)) {
        setScalingRecipe(parsed)
      } else if (typeof parsed == "number") {
        setScalingRecipe({ method: ScaleMethod.Geometric, values: [{ value: parsed, weight: 1 }] })
      }
    }
    // Fail silently if combination scale is missing, notify user if it's malformed
    catch (error) {
      if (currentGoal?.combinationScale) {
        console.error("Failed to parse scaling recipie", error)
      }
    }
  }, [currentGoal]);

  const timestamp = useMemo(() => Date.now(), []);

  // Submit the form to the API
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);

    const links = getLinks(event.target);

    // Convert the data series to an array of numbers, the actual parsing is done by the API
    const dataSeriesInput = (form.namedItem("dataSeries") as HTMLInputElement | null)?.value;
    const dataSeries = dataSeriesInput?.replaceAll(',', '.').split(/[\t;]/);

    // And likewise for the baseline data series, if any
    const baselineDataSeriesInput = (form.namedItem("baselineDataSeries") as HTMLInputElement | null)?.value;
    // The baseline may be omitted, in which case we don't want to send an empty array
    const baselineDataSeries = baselineDataSeriesInput ? baselineDataSeriesInput?.replaceAll(',', '.').split(/[\t;]/) : undefined;

    const { scalingRecipie: combinationScale } = getScalingResult(formData, scalingRecipie.method || ScaleMethod.Geometric);

    const inheritFrom: GoalInput["inheritFrom"] = [];
    formData.getAll("inheritFrom")?.forEach((id) => {
      if (id instanceof File) {
        return;
      } else if (formData.getAll("invert-inherit")?.includes(id)) {
        inheritFrom.push({ id: id, isInverted: true });
        return;
      } else {
        inheritFrom.push({ id: id });
      }
    })

    let parsedUnit: string | null = null;
    try {
      parsedUnit = mathjs.unit((form.namedItem("dataUnit") as HTMLInputElement)?.value).toString();
    } catch {
      console.log("Failed to parse unit. Using raw string instead, which may disable some features.");
    }

    const formJSON = JSON.stringify({
      name: (form.namedItem("goalName") as HTMLInputElement)?.value || null,
      description: (form.namedItem("description") as HTMLInputElement)?.value || null,
      indicatorParameter: (form.namedItem("indicatorParameter") as HTMLInputElement)?.value || null,
      dataUnit: parsedUnit || (form.namedItem("dataUnit") as HTMLInputElement)?.value || null,
      dataSeries: dataSeries,
      dataScale: (form.namedItem("scale") as HTMLInputElement)?.checked ? null : undefined,
      baselineDataSeries: baselineDataSeries,
      combinationScale: JSON.stringify(combinationScale),
      inheritFrom: inheritFrom,
      roadmapId: currentGoal?.roadmapId || roadmapId || (typeof formData.get("roadmapId") == "string" ? formData.get("roadmapId") : null),
      goalId: currentGoal?.id || null,
      links,
      timestamp,
      isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked,
    } as GoalInput);

    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST');
  }

  async function recalculateScalingResult() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the form to update; without this we get the value *before* the action that triggered the update
    if (typeof document != "undefined") {
      const formElement = document.forms.namedItem("goalForm");
      if (formElement instanceof HTMLFormElement) {
        const formData = new FormData(formElement);
        const scalingMethod = formData.get("scalingMethod")?.valueOf() as ScaleMethod;
        const { scaleFactor, scalingRecipie: tempRecipie } = getScalingResult(formData, scalingMethod || ScaleMethod.Geometric);
        // Avoid setting state if the value hasn't changed.
        if (tempRecipie !== scalingRecipie) {
          setScalingRecipe(tempRecipie);
        }
        if (Number.isFinite(scaleFactor) && scaleFactor !== scalingResult) {
          setScalingResult(scaleFactor);
        } else if (isNaN(scaleFactor) && scalingResult !== null) {
          setScalingResult(null);
        }
      }
    }
  }

  // If there is a data series, convert it to an array of numbers to use as a default value for the form
  const dataArray: (number | null)[] = []
  if (currentGoal?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentGoal.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  // Likewise for any baseline data series
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit} onChange={() => { recalculateScalingResult() }} name="goalForm">
        {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* Allow user to select parent roadmap if not already selected */}
        {!(roadmapId || currentGoal?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>Ange relationen till andra inlägg</legend>
            <label className="block margin-block-100">
              Välj färdplansversion att skapa målbanan under:
              <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}
                onChange={(e) => setSelectedRoadmap(e.target.value)}
              >
                <option value="" disabled>Välj färdplansversion</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} åtgärder`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>Välj typ av dataserie för din målbana</legend>
          <label className="block margin-block-100">
            Dataserie
            <select name="dataSeriesType" id="dataSeriesType" className="block margin-block-25" required
              defaultValue={!currentGoal?.combinationParents.length ? DataSeriesType.Static : currentGoal.combinationParents.length >= 2 ? DataSeriesType.Combined : DataSeriesType.Inherited}
              onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            >
              <option value={DataSeriesType.Static}>Statisk</option>
              <option value={DataSeriesType.Inherited}>Ärvd</option>
              <option value={DataSeriesType.Combined}>Kombinerad</option>
            </select>
          </label>
        </fieldset>


        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Beskriv din målbana</legend>
          <label className="block margin-bottom-100">
            Namn på målbanan
            <input className="margin-block-25" type="text" name="goalName" id="goalName" defaultValue={currentGoal?.name ?? undefined} />
          </label>

          <label className="block margin-block-100">
            Beskrivning av målbanan
            <textarea className="margin-block-25" name="description" id="description" defaultValue={currentGoal?.description ?? undefined}></textarea>
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Beskriv hur din målbanas data är utformad</legend>
          {(dataSeriesType === DataSeriesType.Static || !dataSeriesType) &&
            <ManualGoalForm currentGoal={currentGoal} dataSeriesString={dataSeriesString} />
          }

          {dataSeriesType === DataSeriesType.Inherited &&
            <InheritedGoalForm currentGoal={currentGoal} roadmapAlternatives={roadmapAlternatives} />
          }

          {dataSeriesType === DataSeriesType.Combined &&
            <CombinedGoalForm currentGoal={currentGoal} roadmapId={currentGoal?.roadmapId || roadmapId || selectedRoadmap} />
          }

          {(dataSeriesType === DataSeriesType.Inherited || dataSeriesType === DataSeriesType.Combined) &&
            <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
              <legend>Skalning</legend>
              <div className="margin-block-100">
                {scalingRecipie.values.map((value, index) => {
                  return (
                    <RepeatableScaling
                      key={`scalar-${index}`}
                      useWeight={scalingRecipie.method != ScaleMethod.Multiplicative}
                      defaultSpecificValue={value.type == ScaleBy.Custom || !value.type ? value.value : undefined}
                      defaultParentArea={value.type == ScaleBy.Area || value.type == ScaleBy.Inhabitants ? value.parentArea : undefined}
                      defaultChildArea={value.type == ScaleBy.Area || value.type == ScaleBy.Inhabitants ? value.childArea : undefined}
                      defaultScaleBy={value.type || ScaleBy.Custom}
                    > {/* Multiplicative scaling doesn't use weights */}
                      <button type="button"
                        onClick={() => setScalingRecipe({ method: scalingRecipie.method, values: scalingRecipie.values.filter((_, i) => i !== index) })}>
                        <Image src='/icons/circleMinus.svg' alt="Ta bort skalning" width={24} height={24} />
                      </button>
                    </RepeatableScaling>
                  )
                })}
              </div>
              <button type="button" className="margin-block-100" onClick={() => setScalingRecipe({ method: scalingRecipie.method, values: [...scalingRecipie.values, { value: 1 }] })}>Lägg till skalning</button>

              <label className="block margin-block-100">
                Skalningsmetod:
                <select name="scalingMethod" id="scalingMethod" className="margin-inline-25" defaultValue={scalingRecipie.method || ScaleMethod.Geometric}>
                  <option value={ScaleMethod.Geometric}>Geometriskt genomsnitt (rekommenderad)</option>
                  <option value={ScaleMethod.Algebraic}>Algebraiskt genomsnitt</option>
                  <option value={ScaleMethod.Multiplicative}>Multiplikativ</option>
                </select>
              </label>

              <label className="block margin-block-100">
                <strong className="block bold">Resulterande skalfaktor: </strong>
                <output className="margin-block-100 block">{scalingResult}</output>
              </label>
            </fieldset>
          }
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Välj baslinje för åtgärder</legend>
          <label className="block margin-bottom-100">
            Vilken baslinje ska man utgå från när man beräknar åtgärders effekt på målbanan?
            <select className="block margin-block-25" name="baselineSelector" id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
              <option value={BaselineType.Initial}>Första årets värde</option>
              <option value={BaselineType.Custom}>Anpassad baslinje</option>
              <option value={BaselineType.Inherited}>Använd en annan målbana som baslinje</option>
            </select>
          </label>

          {baselineType === BaselineType.Custom &&
            <label className="block margin-block-100">
              Anpassad baslinje:
              {/* TODO: Make this allow .csv files and possibly excel files */}
              <input type="text" name="baselineDataSeries" id="baselineDataSeries"
                pattern={dataSeriesPattern}
                title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
                className="margin-block-25"
                defaultValue={baselineString}
              />
            </label>
          }

          {baselineType === BaselineType.Inherited &&
            <InheritingBaseline />
          }
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>Bifoga externa resurser</legend>
          <LinkInput links={currentGoal?.links} />
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Vill du lyfta fram den här målbana under din färdplansversion?</legend>
          <label className="flex align-items-center gap-50 margin-block-50">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} /> {/* TODO: Make toggle */}
            Lyft fram min målbana
          </label>
        </fieldset>

        {
          currentGoal?.dataSeries?.scale ?
            <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
              <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>
                Målbanan innehåller en skala. Vänligen baka in skalan i värdet eller enheten och checka sedan i den här boxen; alla skalor kommer att tas bort i framtiden
              </legend>
              <label className="flex align-items-center gap-50 margin-block-50">
                <input type="checkbox" name="scale" id="scale" />
                Ta bort skalan {`"${currentGoal?.dataSeries?.scale}"`}
              </label>
            </fieldset>
            : null
        }

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentGoal ? "Spara" : "Skapa målbana"} />
      </form>

      <datalist id="LEAPOptions">
        {/* Use all unique entries as suggestions for indicator parameter */}
        {parameterOptions.filter((option, index, self) => {
          return self.indexOf(option) === index
        }).map((option) => {
          return (
            <option key={`option-${option}`} value={option} />
          )
        })}
      </datalist>
    </>
  )
}