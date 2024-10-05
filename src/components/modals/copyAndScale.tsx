'use client';

import { DataSeries, Goal } from "@prisma/client";
import Image from "next/image";
import { closeModal, openModal } from "./modalFunctions";
import { useRef, useState } from "react";
import RepeatableScaling from "../repeatableScaling";
import { GoalInput, dataSeriesDataFieldNames, ScaleBy, ScaleMethod, ScalingRecipie } from "@/types";
import formSubmitter from "@/functions/formSubmitter";

/** Get the resulting scaling factor from form data */
export function getScalingResult(form: FormData, scalingMethod: ScaleMethod, setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>) {
  const scalars = form.getAll("scaleFactor");
  const scalingTypes = form.getAll("scaleBy");
  const weights = form.getAll("weight");
  const parentAreas = form.getAll("parentArea");
  const childAreas = form.getAll("childArea")
  let scaleFactor: number = 1;
  let totalWeight: number;
  // Index for getting parentArea and childArea for ScaleBy.Inhabitants and ScaleBy.Area
  let mutableScalarIndex: number = 0;
  const scalingRecipie: ScalingRecipie = { values: [] }
  // If the input is a single value, use it as the scale factor
  if (scalars.length == 1) {
    // If any of the inputs are files, throw. This will only happen if the user has tampered with the form, so no need to give a nice error message
    if (scalars[0] instanceof File) {
      if (setIsLoading) setIsLoading(false);
      throw new Error("Why is this a file?");
    }
    const tempScale = parseFloat(scalars[0].replace(",", "."));
    const scalingType = scalingTypes[0] as (ScaleBy | "");
    const weight = parseFloat((weights[0] as string ?? "1").replace(",", "."));
    // If the value is a number, use it as the scale factor
    if (Number.isFinite(tempScale)) {
      scaleFactor = tempScale;
      if (scalingType == ScaleBy.Custom) {
        scalingRecipie.values.push({
          type: scalingType,
          value: tempScale,
          weight: Number.isFinite(weight) ? weight : 1,
        });
      } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
        scalingRecipie.values.push({
          type: scalingType,
          parentArea: parentAreas[mutableScalarIndex] as string,
          childArea: childAreas[mutableScalarIndex] as string,
          weight: Number.isFinite(weight) ? weight : 1,
        })
      } else {
        scalingRecipie.values.push({
          value: tempScale,
        });
      }
    };
  }
  // If there are multiple inputs, loop through them and calculate the average of the scale factors, based on the scaling method
  else if (scalars.length > 1) {
    switch (scalingMethod) {
      case ScaleMethod.Algebraic:
        scalingRecipie.method = ScaleMethod.Algebraic;
        totalWeight = 0;
        scaleFactor = 0;
        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File || weights[i] instanceof File || parentAreas[i] instanceof File || childAreas[i] instanceof File || (scalingTypes[i] as any) instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");
          const weight: number = parseFloat((weights[i] as string ?? "1").replace(",", "."));

          // If scalar is a number, add it to the total scale factor, weighted by the weight
          // If weight is not a number, default to 1 (but allow 0 to be used as a weight)
          if (Number.isFinite(scalar)) {
            if (Number.isFinite(weight)) {
              totalWeight += weight;
              scaleFactor += scalar * weight;
            } else {
              totalWeight += 1;
              scaleFactor += scalar * 1;
            }
            if (scalingType == ScaleBy.Custom) {
              scalingRecipie.values.push({
                type: scalingType,
                value: scalar,
                weight: Number.isFinite(weight) ? weight : 1,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipie.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
                weight: Number.isFinite(weight) ? weight : 1,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        // If the total weight is not 0, divide the scale factor by it to get the weighted average
        if (totalWeight != 0) {
          scaleFactor /= totalWeight;
        }
        break;
      case ScaleMethod.Multiplicative:
        scalingRecipie.method = ScaleMethod.Multiplicative;
        scaleFactor = 1;
        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");

          // If scalar is a number, multiply total scale factor with it
          if (Number.isFinite(scalar)) {
            scaleFactor *= scalar;
            if (scalingType == ScaleBy.Custom) {
              scalingRecipie.values.push({
                type: scalingType,
                value: scalar,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipie.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        break;
      // Default to geometric scaling
      case ScaleMethod.Geometric:
      default:
        scalingRecipie.method = ScaleMethod.Geometric;
        totalWeight = 0;
        scaleFactor = 1; // This initial value won't affect the result since it's the identity element for multiplication and is not given a weight

        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File || weights[i] instanceof File || parentAreas[i] instanceof File || childAreas[i] instanceof File || (scalingTypes[i] as any) instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");
          const weight: number = parseFloat((weights[i] as string ?? "1").replace(",", "."));

          // If scalar is a number, multiply total scale factor with it, weighted by the weight
          // If weight is not a number, default to 1 (but allow 0 to be used as a weight)
          if (Number.isFinite(scalar)) {
            if (Number.isFinite(weight)) {
              totalWeight += weight;
              scaleFactor *= Math.pow(scalar, weight);
            } else {
              totalWeight += 1;
              scaleFactor *= Math.pow(scalar, 1);
            }
            if (scalingType == ScaleBy.Custom) {
              scalingRecipie.values.push({
                type: scalingType,
                value: scalar,
                weight: Number.isFinite(weight) ? weight : 1,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipie.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
                weight: Number.isFinite(weight) ? weight : 1,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        // Take the totalWeight-th root of the scale factor to get the weighted geometric mean
        // Will return NaN if the scale factor is negative before taking the root
        scaleFactor = Math.pow(scaleFactor, (1 / totalWeight));
        break;
    }
  }
  return { scaleFactor, scalingRecipie };
}

export default function CopyAndScale({
  goal,
  roadmapOptions,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  roadmapOptions: { id: string, name: string, version: number, actor: string | null }[],
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [scalingComponents, setScalingComponents] = useState<string[]>([crypto?.randomUUID() || Math.random().toString()]);
  const [scalingMethod, setScalingMethod] = useState<ScaleMethod>(ScaleMethod.Geometric);
  const [scalingResult, setScalingResult] = useState<number>(1);

  const modalRef = useRef<HTMLDialogElement | null>(null);

  async function recalculateScalingResult() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the form to update; without this we get the value *before* the action that triggered the update
    if (typeof document != "undefined") {
      const formElement = document.forms.namedItem("copyAndScale");
      if (formElement instanceof HTMLFormElement) {
        const formData = new FormData(formElement);
        const { scaleFactor } = getScalingResult(formData, scalingMethod);
        // Avoid setting the state if the value hasn't changed, to prevent infinite rerenders
        // Also don't set the state if the value is NaN, infinite, or non-numeric
        if (Number.isFinite(scaleFactor) && scaleFactor !== scalingResult) {
          setScalingResult(scaleFactor);
        }
      }
    }
  }
  recalculateScalingResult();

  function formSubmission(form: FormData) {
    setIsLoading(true);

    // If any of the inputs are files, throw. This will only happen if the user has tampered with the form, so no need to give a nice error message

    // Id of the roadmap to copy the goal to
    const copyToId = form.get("copyTo");
    if (copyToId instanceof File) {
      setIsLoading(false);
      throw new Error("Why is this a file?");
    }

    const { scaleFactor, scalingRecipie } = getScalingResult(form, scalingMethod, setIsLoading);
    console.log(scalingRecipie)
    // Don't proceed if the resultant scale factor is NaN, infinite, or non-numeric for some reason
    if (!Number.isFinite(scaleFactor)) {
      setIsLoading(false);
      alert("Felaktig inmatning. Skalningsfaktorn kunde inte beräknas. Ofta beror detta på ett ickenumeriskt värde i ett inmatningsfält eller att produkten av alla skalningsfaktorer är negativ.");
      return;
    }

    // Get the data series from current goal
    const dataSeries: string[] = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = goal.dataSeries?.[i];
      if (value == undefined) {
        dataSeries.push("");
      } else {
        dataSeries.push((value * scaleFactor).toString());
      }
    }

    const formData: GoalInput & { roadmapId: string } = {
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      dataUnit: goal.dataSeries?.unit || "missing",
      dataScale: goal.dataSeries?.scale || undefined,
      dataSeries: dataSeries,
      roadmapId: copyToId ?? "",
      inheritFrom: [{ id: goal.id }],
      combinationScale: JSON.stringify(scalingRecipie),
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/goal', formJSON, 'POST', setIsLoading);
  }

  return (
    <>
      <button type="button" className="seagreen color-purewhite round flex gap-50" style={{ fontSize: '1rem', fontWeight: '500' }} onClick={() => openModal(modalRef)}>
        Kopiera och skala målbana
        <Image src='/icons/copy.svg' alt="" width={24} height={24} />
      </button>
      <dialog ref={modalRef} aria-modal style={{ border: '0', borderRadius: '.5rem', boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25' }}>
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between`}>
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label="Close" >
            <Image src='/icons/close.svg' alt="" width={18} height={18} />
          </button>
          <h2 className="margin-0">Kopiera och skala målbanan {goal.name}</h2>
        </div>

        <form action={formSubmission} name="copyAndScale" onChange={recalculateScalingResult}>

          <label className="block margin-block-100">
            I vilken färdplan vill du placera den skalade målbanan?
            <select className="block margin-block-25 width-100" required name="copyTo" id="copyTo">
              <option value="">Välj färdplan</option>
              {roadmapOptions.map(roadmap => (
                <option key={roadmap.id} value={roadmap.id}>{`${roadmap.name} ${roadmap.version ? `(version ${roadmap.version.toString()})` : null}`}</option>
              ))}
            </select>
          </label>

          <div className="margin-block-100">
            {scalingComponents.map((id) => {
              return (
                <RepeatableScaling key={id} useWeight={scalingMethod != ScaleMethod.Multiplicative}> {/* Multiplicative scaling doesn't use weights */}
                  <button type="button"
                    style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      transform: 'translate(50%, calc(-20px - 50%))',
                      backgroundColor: 'white',
                      padding: '.25rem',
                      borderRadius: '100%',
                      display: 'grid',
                      cursor: 'pointer'
                    }} onClick={() => setScalingComponents(scalingComponents.filter((i) => i !== id))}>
                    <Image src='/icons/circleMinus.svg' alt="Ta bort skalning" width={24} height={24} />
                  </button>
                </RepeatableScaling>
              )
            })}
          </div>
          <button type="button" className="margin-block-100" onClick={() => setScalingComponents([...scalingComponents, (crypto?.randomUUID() || Math.random().toString())])}>Lägg till skalning</button>

          <details className="padding-block-25 margin-block-75" style={{ borderBottom: '1px solid var(--gray-90)' }}>
            <summary>Avancerat</summary>
            <fieldset className="margin-block-100">
              <legend>Välj skalningsmetod</legend>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Geometric} checked={scalingMethod === ScaleMethod.Geometric} onChange={() => setScalingMethod(ScaleMethod.Geometric)} />
                Geometriskt genomsnitt
              </label>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Algebraic} checked={scalingMethod === ScaleMethod.Algebraic} onChange={() => setScalingMethod(ScaleMethod.Algebraic)} />
                Algebraiskt genomsnitt
              </label>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Multiplicative} checked={scalingMethod === ScaleMethod.Multiplicative} onChange={() => setScalingMethod(ScaleMethod.Multiplicative)} />
                Multiplikativ skalning
              </label>
            </fieldset>
          </details>

          <label style={{ marginInline: 'auto' }}>
            <strong className="block bold" style={{ textAlign: 'center' }}>Resulterande skalfaktor</strong>
            <output className="margin-block-100 block" style={{ textAlign: 'center' }}>{scalingResult}</output>
          </label>

          <button className="block seagreen color-purewhite smooth width-100" style={{ marginInline: 'auto', fontWeight: '500' }}>
            Skapa skalad kopia
          </button>
        </form>
      </dialog>
    </>
  )
}