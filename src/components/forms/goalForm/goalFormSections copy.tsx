"use client";

import { clientSafeGetOneGoal } from "@/fetchers/getOneGoal";
import { clientSafeGetOneRoadmap } from "@/fetchers/getOneRoadmap";
import type getRoadmaps from "@/fetchers/getRoadmaps";
import { clientSafeGetRoadmaps } from "@/fetchers/getRoadmaps";
import mathjs from "@/math";
import CaseHandler from "@/scripts/caseHandler";
import { dataSeriesDataFieldNames } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { Fragment, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { dataSeriesPattern } from "./goalForm";
import styles from "./goalForm.module.css";

export function ManualGoalForm({
  currentGoal,
  dataSeriesString,
}: {
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        dataSeries: DataSeries | null
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
  dataSeriesString?: string,
}) {
  const { t } = useTranslation();
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  const inputGridElement = document.getElementById("inputGrid");

  /**
   * Function for drawing grid columns
   * @param columnIndex the index of the column to draw (starting at 1)
   * @returns JSX element for the column
   */
  function drawGridColumn(columnIndex: number) {
    return (
      <div key={`column-${columnIndex}`}>
        <label htmlFor={dataSeriesDataFieldNames[columnIndex]} className="padding-25">{dataSeriesDataFieldNames[columnIndex].replace("val", "")}</label>
        <input type="number" id={dataSeriesDataFieldNames[columnIndex]} name="dataSeriesInput" value={dataSeriesString?.split(/[\t;]/)[columnIndex]} onChange={() => updateStringInput} />
      </div>
    )
  }

  // Create a list of columns for the input grid
  // Make sure there is at least one column
  const defaultColumnCount = (1 > dataSeriesDataFieldNames.length) ? 1 : dataSeriesDataFieldNames.length;
  let columnCount = defaultColumnCount;
  let columns: JSX.Element[] = [];
  for (let i = 0; i < (columnCount); i++) {
    columns.push(drawGridColumn(i));
  }

  /**
   * Generate a string of CSS attributes from a style object
   * @param style object containing CSS attributes
   * @returns string of CSS attributes
   */
  function getStyleString(style: { [attribute: string]: string }) {
    const attributes = style ? Object.keys(style) : null;
    return attributes?.map((attribute) => `${CaseHandler.toKebabCase(attribute)}: ${style[attribute]}`).join("; ") ?? "";
  }

  /**
   * Generate HTML text for children of a JSX element
   * @param children List of JSX elements to be returned as HTML text
   * @returns string of HTML elements
   */
  function getChildrenString(children: JSX.Element[]) {
    let childrenString = "";

    // Loop through the children and add them to the string in HTML format
    children.forEach((child: JSX.Element) => {
      let propsString = "";

      // Loop through the props of the child element and add them to the props string in HTML format
      for (const key in child.props) {
        if (key === "children") {
          continue;
        } else if (key === "style") {
          propsString += ` style="${getStyleString(child.props[key])}"`;
          continue;
        } else if (key === "className") {
          propsString += ` class="${child.props[key]}"`;
          continue;
        } else if (key === "onChange" || key === "onPaste") {
          continue; // the event listeners are added later
        }
        propsString += ` ${key}="${child.props[key]}"`;
      }

      // Create an opening tag and a closing tag if the child has children, otherwise self-close the tag
      childrenString += `<${child.type}${propsString}${child.props.children ? `>${Array.isArray(child.props.children) ? child.props.children.join("") : [child.props.children].join("")}</${child.type}>` : "/>"}`;
    })

    return childrenString;
  }

  /**
   * Generate HTML text for the grid of input elements
   * @returns HTML string for the grid of input elements
   */
  function generateInputGridInnerHTML() {
    return columns.map(column => `<${column.type} style="${getStyleString(column.props.style)}">${getChildrenString(column.props.children)}</${column.type}>`).join("");
  }

  /**
   * Update the input grid element with new columns
   * @param inputGridElement The element to update
   */
  function updateInputGrid(inputGridElement: HTMLElement) {
    inputGridElement.innerHTML = generateInputGridInnerHTML();

    // Add on change event listeners to all the input elements
    const inputGridInputBoxes = inputGridElement.getElementsByTagName("input");
    for (const inputBox of inputGridInputBoxes) {
      inputBox.addEventListener("change", () => updateStringInput);
      inputBox.addEventListener("paste", handleFocusedPaste);
    }

    inputGridElement.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
    // Add an on paste event listener to the input grid element
    if (inputGridElement) {
      // inputGridElement.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent));
    } else {
      console.warn("Unable to add event listeners to input grid element because it could not be found.");
    }
  }

  /**
   * Function to insert values into the input grid
   * @param values a string or array of values to insert. If a string, it will be split by semicolon or tab
   */
  function insertValuesToInputGrid(values: string | string[], startingColumn?: number) {
    // Make sure to get the values as an array if it is a string and make sure there are no more than the allowed amount of values
    // const valuesList = (Array.isArray(values) ? values : values.split(/[\t;]/)).slice(0, defaultColumnCount);
    const valuesList = (Array.isArray(values) ? values : values.split(/[\t;]/)).slice(0, defaultColumnCount);

    const inputGrid = document.getElementById("inputGrid");
    if (!inputGrid) {
      console.warn("\"inputGrid\" does not exist");
      return;
    }
    console.log(valuesList);
    // if (startingColumn) {
    //   for (let i = 0; i < startingColumn && i < defaultColumnCount; i++) {
    //     valuesList.push
    //   }
    // } else {
    //   valuesList = (Array.isArray(values) ? values : values.split(/[\t;]/)).slice(0, defaultColumnCount);
    // }

    // Generate the columns for the input grid
    columnCount = valuesList.length > inputGrid.getElementsByTagName("input").length ? valuesList.length : defaultColumnCount;
    const newValuesList: string[] = []; // Explicitly define as string array
    for (const input of inputGrid.getElementsByTagName("input")) {
      newValuesList.push(input.value);
    }
    if (startingColumn) {
      for (let i = startingColumn; i < valuesList.length; i++) {
        newValuesList[i] = valuesList[i - startingColumn];
      }
      updateStringInput(newValuesList.join(";"));
    }
    columns = [];
    for (let i = 0; i < (columnCount); i++) {
      columns.push(drawGridColumn(i));
    }

    // Update the input grid element with the new columns and values
    updateInputGrid(inputGrid);
    const inputs = inputGrid.getElementsByTagName("input");
    for (let i = 0; i < inputs.length; i++) {
      if (startingColumn && i >= startingColumn && i < startingColumn + valuesList.length) {
        inputs[i].value = valuesList[i - startingColumn]
      }
    }
  }

  /**
   * Function to get the values from the input grid and return them as an array
   * @returns array of values from the input grid
   */
  function getValuesFromInputGrid() {
    const inputGrid = document.getElementById("inputGrid");
    if (!inputGrid) { console.warn("\"inputGrid\" does not exist"); return; }

    // Get the values from all the input elements in the grid
    const inputs = inputGrid.getElementsByTagName("input");
    const values = [];
    for (let i = 0; i < inputs.length; i++) {
      values.push(inputs[i].value);
    }
    return values;
  }

  /**
   * Function to update the string input with the values from the input grid
   */
  function updateStringInput(customValuesString?: string) {
    let valuesString = getValuesFromInputGrid()?.join(";");
    if (customValuesString) {
      valuesString = customValuesString;
    }

    const input = document.getElementById("dataSeries") as HTMLInputElement | null;
    if (input && valuesString) {
      input.value = valuesString;
    }
  }

  /**
   * Function to handle changes to the string input and update the input grid
   * @param e the event object from the input change
   */
  function handleStringInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Update the input grid with the new values from the string input
    insertValuesToInputGrid(e.target.value);
    // Call this to make sure there are not too many values in the string input
    updateStringInput();
  }

  // /**
  //  * Function to handle pasting into the input grid
  //  */
  // function handlePaste(e: ClipboardEvent) {
  //   if (!e.clipboardData) return;
  //   const clip = e.clipboardData.getData("text");
  //   insertValuesToInputGrid(clip);
  // }

  /**
   * Function to handle pasting into the input grid
   */
  function handleFocusedPaste(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    const clip = e.clipboardData.getData("text");
    if (!inputGridElement) {
      console.warn("inputGridElement does not exist");
      return;
    }
    insertValuesToInputGrid(clip, [...inputGridElement.getElementsByTagName("input")].indexOf(e.target as HTMLInputElement));
    updateStringInput();
  }

  // Add event listeners for pasting
  if (inputGridElement) {
    for (const inputElement of inputGridElement.getElementsByTagName("input")) {
      inputElement.addEventListener("paste", (e) => handleFocusedPaste(e as ClipboardEvent));
    }


  } else {
    console.warn("Can't add event listeners");
  }

  if (dataSeriesString && document.getElementById("dataSeries") && (document.getElementById("dataSeries") as HTMLSelectElement).value == dataSeriesString) {
    insertValuesToInputGrid(dataSeriesString);
  }

  return (
    <>
      <label className="block margin-bottom-100">
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
        }
      </label>

      <details className="margin-block-75">
        <summary>
          {t("forms:goal.extra_info_data_series")}
        </summary>
        <p>
          <Trans
            i18nKey={"forms:goal.data_series_info"}
            components={{ strong: <strong />, br: <br /> }}
          />
        </p>
      </details>

      <label className="block margin-block-75">
        {t("forms:goal.data_series")}
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <div style={{ border: "1px solid var(--gray-90)", padding: ".25rem", borderRadius: "0.25rem", maxWidth: "48.5rem" }}>
          <div id="inputGrid" className={`${styles.sideScroll}`} style={{ display: "grid", gridTemplateColumns: `repeat(${columnCount}, 1fr)`, gap: "0rem", gridTemplateRows: "auto", borderRadius: "0.25rem" }}>
            {columns.map((column) => column)}
          </div>
        </div>
        <input type="text" name="dataSeries" required id="dataSeries"
          pattern={dataSeriesPattern}
          title={t("forms:goal.data_series_title")}
          className="margin-block-25"
          defaultValue={dataSeriesString}
          onChange={(e) => handleStringInputChange(e)}
        />
      </label>
    </>
  )
}

export function InheritedGoalForm({
  currentGoal,
  roadmapAlternatives,
}: {
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
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
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
}) {
  const { t } = useTranslation();
  const [selectedRoadmap, setSelectedRoadmap] = useState(currentGoal?.combinationParents[0]?.parentGoal.roadmapId);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState(currentGoal?.combinationParents[0]?.parentGoal.id);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof clientSafeGetOneGoal>>>(null);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    if (currentGoal?.combinationParents[0]?.parentGoal.roadmapId) {
      setSelectedRoadmap(currentGoal.combinationParents[0].parentGoal.roadmapId);
    }
    if (currentGoal?.combinationParents[0]?.parentGoal.id) {
      setSelectedGoal(currentGoal.combinationParents[0].parentGoal.id);
    }
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  useEffect(() => {
    clientSafeGetOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData);
  }, [selectedRoadmap]);

  useEffect(() => {
    clientSafeGetOneGoal(selectedGoal ?? "").then(setGoalData)
  }, [selectedGoal]);
  return (
    <>
      <label className="block margin-block-75">
        {t("forms:goal.select_roadmap_version")}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{t("forms:goal.select_roadmap_version")}</option>
          {roadmapAlternatives.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {t("forms:goal.select_goal_to_inherit")}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{t("forms:goal.select_goal")}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-block-75">
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-block-75">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
        }
      </label>
    </>
  )
}

export function CombinedGoalForm({
  roadmapId,
  currentGoal,
}: {
  roadmapId?: string,
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
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
  const { t } = useTranslation();
  const [currentRoadmap, setCurrentRoadmap] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [inheritFrom, setInheritFrom] = useState<string[]>([]);
  const [parsedUnit, setParsedUnit] = useState<string | null>(null);

  useEffect(() => {
    clientSafeGetOneRoadmap(roadmapId || '').then(setCurrentRoadmap);
  }, [roadmapId]);

  useEffect(() => {
    if (currentGoal?.combinationParents) {
      setInheritFrom(currentGoal.combinationParents.map((parent) => parent.parentGoal.id));
    }
    if (currentGoal?.dataSeries?.unit) {
      try {
        setParsedUnit(mathjs.unit(currentGoal.dataSeries.unit).toString());
      } catch {
        setParsedUnit(null)
      }
    }
  }, [currentGoal]);

  return (
    <>
      <label className="block margin-block-75">
        {t("forms:goal.leap_parameter")}
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-75">
        {t("forms:goal.data_unit")}
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">{t("forms:goal.unit_interpreted_as")} <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">{t("forms:goal.unit_not_interpreted")}</p>
        }
      </label>

      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="padding-25">
          {t("forms:goal.select_goals_to_combine")}
        </legend>
        <Trans
          i18nKey={"forms:goal.search_tip"}
          components={{ kbd: <kbd /> }}
        />
        {currentRoadmap?.goals.map((goal) => (
          goal.id == currentGoal?.id ? null :
            <Fragment key={`combine-${goal.id}`}>
              <label className="block margin-block-25">
                <input type="checkbox" name="inheritFrom" className="margin-inline-25" value={goal.id}
                  defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setInheritFrom([...inheritFrom, e.target.value]);
                    } else {
                      setInheritFrom(inheritFrom.filter((id) => id != e.target.value));
                    }
                  }}
                />
                {`${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </label>
              {/* TODO: marginLeft: 25? What? */}
              {inheritFrom?.includes(goal.id) &&
                <label className="block margin-block-25" style={{ marginLeft: 25 }}>
                  <input type="checkbox" name="invert-inherit" className="margin-inline-25" value={goal.id}
                    defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id && parent.isInverted)}
                  />
                  {t("forms:goal.invert_goal")}
                </label>
              }
            </Fragment>
        ))}
      </fieldset>
    </>
  )
}

export function InheritingBaseline() {
  const { t } = useTranslation();
  const [roadmapList, setRoadmapList] = useState<Awaited<ReturnType<typeof clientSafeGetRoadmaps>>>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string | undefined>(undefined);
  const [roadmapData, setRoadmapData] = useState<Awaited<ReturnType<typeof clientSafeGetOneRoadmap>>>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | undefined>(undefined);
  const [goalData, setGoalData] = useState<Awaited<ReturnType<typeof clientSafeGetOneGoal>>>(null);

  useEffect(() => {
    clientSafeGetRoadmaps().then(setRoadmapList);
  }, []);

  useEffect(() => {
    clientSafeGetOneRoadmap(selectedRoadmap ?? "").then(setRoadmapData);
  }, [selectedRoadmap]);

  useEffect(() => {
    clientSafeGetOneGoal(selectedGoal ?? "").then(setGoalData)
  }, [selectedGoal]);

  // If there is a data series, convert it to an array of numbers and then a string to use for the form
  const dataArray: (number | null)[] = []
  if (goalData?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(goalData.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  return (
    <>
      <label className="block margin-block-75">
        {t("forms:goal.select_roadmap_version")}
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">{t("forms:goal.select_roadmap_version")}</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.goal", { count: roadmap._count.goals })}`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          {t("forms:goal.select_goal_as_baseline")}
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">{t("forms:goal.select_goal")}</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
                {`${(!goal.dataSeries) ? t("forms:goal.data_missing") : ""}${goal.name ?? t("forms:goal.unnamed_goal")}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || t("forms:goal.unit_missing")})`}
              </option>
            ))}
          </select>
        </label>
      }

      {goalData &&
        <label className="block margin-block-75">
          {t("forms:goal.baseline_copied")}
          <input name="baselineDataSeries" id="baselineDataSeries" type="text" readOnly value={dataSeriesString} />
        </label>
      }
    </>
  )
}