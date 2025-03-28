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
import { dataSeriesPattern } from "./goalForm";

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

  // TODO - update text field input when input grid is changed
  /**
   * Function for drawing grid columns
   * @param columnIndex the index of the column to draw (starting at 1)
   * @returns 
   */
  function drawGridColumn(columnIndex: number) {
    console.log(dataSeriesDataFieldNames[columnIndex]);
    return (
      <div style={{ backgroundColor: "pink" }} key={`column-${columnIndex}`}>
        <label htmlFor={dataSeriesDataFieldNames[columnIndex]} className="padding-25">{dataSeriesDataFieldNames[columnIndex].replace("val", "")}</label>
        <input type="text" id={dataSeriesDataFieldNames[columnIndex]} name="dataSeriesInput" value={dataSeriesString?.split(";")[columnIndex]} />
      </div>
    )
  }

  console.log(dataSeriesDataFieldNames);
  const defaultColumnCount = (1 > dataSeriesDataFieldNames.length) ? 1 : dataSeriesDataFieldNames.length;
  let columnCount = defaultColumnCount;
  let columns: JSX.Element[] = [];
  for (let i = 0; i < (columnCount); i++) {
    const column = drawGridColumn(i);
    columns.push(column);
  }

  /**
   * Generate a string of CSS attributes from a style object
   * @param style object containing CSS attributes
   * @returns string of CSS attributes
   */
  function getStyleString(style: { [attribute: string]: string }) {
    const attributes = Object.keys(style);
    return attributes.map((attribute) => `${CaseHandler.toKebabCase(attribute)}: ${style[attribute]}`).join("; ");
  }

  /**
   * Generate HTML text for children of a JSX element
   * @param children List of JSX elements to be returned as HTML text
   * @returns string of HTML elements
   */
  function getChildrenString(children: JSX.Element[]) {
    let childrenString = "";

    children.forEach((child: JSX.Element) => {
      let propsString = "";

      for (const key in child.props) {
        if (key === "children") {
          continue;
        } else if (key === "style") {
          propsString += ` style="${getStyleString(child.props[key])}"`;
          continue;
        } else if (key === "className") {
          propsString += ` class="${child.props[key]}"`;
          continue;
        }
        propsString += ` ${key}="${child.props[key]}"`;
      }

      childrenString += `<${child.type}${propsString}${child.props.children ? `>${Array.isArray(child.props.children) ? child.props.children.join("") : [child.props.children].join("")}</${child.type}>` : "/>"}`;
    })

    return childrenString;
  }

  /**
   * Generate HTML text for the grid of input elements
   * @returns 
   */
  function generateInputGridInnerHTML() {
    console.log("generating inner html")
    console.log(columns);
    return columns.map(column => `<${column.type} style="${getStyleString(column.props.style)}">${getChildrenString(column.props.children)}</${column.type}>`).join("");
  }

  /**
   * Update the input grid element with new columns
   * @param inputGridElement The element to update
   */
  function updateInputGrid(inputGridElement: HTMLElement) {

    inputGridElement.innerHTML = generateInputGridInnerHTML();

    // let re = new RegExp(/<input.+?>/gi);
    // console.log(inputGridElement.innerHTML.match(re));

    inputGridElement.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
    if (inputGridElement) {
      inputGridElement.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent));
    } else {
      console.warn("cant add event listeners when updating input grid");
    }
  }


  function addColumn() {
    console.log("Add column called");
    columnCount++;
    if (columnCount > dataSeriesDataFieldNames.length) {
      columnCount = dataSeriesDataFieldNames.length;
      return;
    }
    columns.push(drawGridColumn(columns.length));
    const inputGrid = document.getElementById("inputGrid");
    if (inputGrid) {
      updateInputGrid(inputGrid);
    }
  }

  function removeColumn() {
    console.log("Remove column called");
    columnCount--;
    if (columnCount < 1) {
      columnCount = 1;
      return;
    }
    columns.pop();
    const inputGrid = document.getElementById("inputGrid");
    if (inputGrid) {
      updateInputGrid(inputGrid);
    }
  }

  /**
   * Function to insert values into the input grid
   * @param values a string or array of values to insert. If a string, it will be split by semicolon or tab
   */
  function insertValuesToInputGrid(values: string | string[]) {
    const valuesList = Array.isArray(values) ? values : values.split(/[\t;]/);
    columnCount = valuesList.length;
    columns = [];
    for (let i = 0; i < (columnCount ? columnCount : defaultColumnCount); i++) {
      columns.push(drawGridColumn(i));
    }
    const inputGrid = document.getElementById("inputGrid");
    if (inputGrid) {
      updateInputGrid(inputGrid);
      const inputs = inputGrid.getElementsByTagName("input");
      valuesList.forEach((value, index) => { // TODO - is this necessary?
        inputs[index].value = value;
      })
    } else {
      console.warn("inputGrid does not exist");
    }
  }

  /**
   * Function to handle pasting into the input grid
   */
  function handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) return;
    const clip = e.clipboardData.getData("text");
    insertValuesToInputGrid(clip);
  }

  // Add event listener for pasting
  if (inputGridElement) {
    inputGridElement.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent));
  } else {
    console.warn("cant add event listeners");
  }

  if (dataSeriesString) {
    insertValuesToInputGrid(dataSeriesString);
  }

  return (
    <>
      <label className="block margin-bottom-100">
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-100">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <details className="margin-block-75">
        <summary>
          Extra information om dataserie
        </summary>
        <p>
          Fältet &quot;Dataserie&quot; tar emot en serie värden separerade med semikolon eller tab, vilket innebär att du kan klistra in en serie värden från Excel eller liknande.<br />
          <strong>OBS: Värden får inte vara separerade med komma (&quot;,&quot;).</strong><br />
          Decimaltal kan använda antingen decimalpunkt eller decimalkomma.<br />
          Det första värdet representerar år 2020 och serien kan fortsätta maximalt till år 2050 (totalt 31 värden).<br />
          Om värden saknas för ett år kan du lämna det tomt, exempelvis kan &quot;;1;;;;5&quot; användas för att ange värdena 1 och 5 för år 2021 och 2025.
        </p>
      </details>

      <label className="block margin-block-75">
        Dataserie
        {/* TODO: Make this allow .csv files and possibly excel files */}
        <input type="text" name="dataSeries" required id="dataSeries"
          pattern={dataSeriesPattern}
          title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
          className="margin-block-25"
          defaultValue={dataSeriesString}
        />
        <button type="button" onClick={() => { console.log(document.getElementById("inputGrid")) }}>Logga</button>
        <button type="button" onClick={addColumn}>Lägg till kolumn</button>
        <button type="button" onClick={removeColumn}>Ta bort kolumn</button>
        <div id="inputGrid" style={{ maxWidth: "50rem", display: "grid", gridTemplateColumns: `repeat(${columnCount}, 1fr)`, gap: "0rem", gridTemplateRows: "auto", overflow: "scroll" }}>
          {columns.map((column) => column)}
        </div>
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
        Välj en färdplansversion att ärva en målbana från
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">Välj färdplansversion</option>
          {roadmapAlternatives.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          Välj en målbana att ärva från
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">Välj målbana</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`}>
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </option>
            ))}
          </select>
        </label>
      }

      <label className="block margin-block-75">
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required disabled id="indicatorParameter" value={goalData?.indicatorParameter || ""} />
      </label>

      <label className="block margin-block-75">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required disabled id="dataUnit" value={goalData?.dataSeries?.unit || ""} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
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
        LEAP parameter
        <input className="margin-block-25" type="text" list="LEAPOptions" name="indicatorParameter" required id="indicatorParameter" defaultValue={currentGoal?.indicatorParameter || undefined} />
      </label>

      <label className="block margin-block-75">
        Enhet för dataserie
        <input className="margin-block-25" type="text" name="dataUnit" required id="dataUnit" defaultValue={currentGoal?.dataSeries?.unit} onChange={(e) => {
          try {
            setParsedUnit(mathjs.unit(e.target.value).toString());
          } catch {
            setParsedUnit(null);
          }
        }} />
        {parsedUnit ?
          <p className="margin-block-25">Enheten tolkas som: <strong>{parsedUnit}</strong></p>
          : <p className="margin-block-25">Enheten kunde inte tolkas. Du kan fortfarande spara målbanan, men viss funktionalitet kan saknas.</p>
        }
      </label>

      <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
        <legend className="padding-25">
          Välj målbanor i den aktuella färdplansversionen att kombinera
        </legend>
        <p>Tips: använd <kbd><kbd>CTRL</kbd> + <kbd>F</kbd></kbd> för att hitta målbanorna du söker efter</p>
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
                {`${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </label>
              {/* TODO: marginLeft: 25? What? */}
              {inheritFrom?.includes(goal.id) &&
                <label className="block margin-block-25" style={{ marginLeft: 25 }}>
                  <input type="checkbox" name="invert-inherit" className="margin-inline-25" value={goal.id}
                    defaultChecked={currentGoal?.combinationParents.some((parent) => parent.parentGoal.id == goal.id && parent.isInverted)}
                  />
                  {"Invertera målet (dividera med denna målbana snarare än att multiplicera)"}
                </label>
              }
            </Fragment>
        ))}
      </fieldset>
    </>
  )
}

export function InheritingBaseline() {
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
        Välj en färdplansversion att hämta målbanan från
        <select name="selectedRoadmap" id="selectedRoadmap" className="margin-inline-25" required
          value={selectedRoadmap}
          onChange={(e) => { setSelectedRoadmap(e.target.value); setSelectedGoal(undefined) }}
        >
          <option value="">Välj färdplansversion</option>
          {roadmapList.map((roadmap) => (
            <option value={roadmap.id} key={`roadmap-inherit${roadmap.id}`}>
              {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.goals} mål`}
            </option>
          ))}
        </select>
      </label>

      {roadmapData &&
        <label className="block margin-block-75">
          Välj en målbana att använda som baslinje (värdena kopieras snarare än att länkas)
          <select name="inheritFrom" id="inheritFrom" className="margin-inline-25" required
            value={selectedGoal}
            onChange={(e) => setSelectedGoal(e.target.value)}
          >
            <option value="">Välj målbana</option>
            {roadmapData?.goals.map((goal) => (
              <option value={goal.id} key={`inherit-${goal.id}`} disabled={!goal.dataSeries}>
                {`${(!goal.dataSeries) ? "DATA SAKNAS; " : ""}${goal.name ?? "Namnlöst mål"}: ${goal.indicatorParameter} (${goal.dataSeries?.unit || "Enhet saknas"})`}
              </option>
            ))}
          </select>
        </label>
      }

      {goalData &&
        <label className="block margin-block-75">
          Baslinje, kopierad från vald målbana
          <input name="baselineDataSeries" id="baselineDataSeries" type="text" readOnly value={dataSeriesString} />
        </label>
      }
    </>
  )
}