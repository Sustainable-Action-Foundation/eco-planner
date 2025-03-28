'use client';

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

  // const inputFormRef = useRef<HTMLFormElement | null>(null);
  const inputGridElement = document.getElementById("inputGrid");

  // console.log(document.getElementById("inputGrid")?.style);
  // console.log(document.getElementById("inputGrid")?.style.gridTemplateColumns);
  // console.log(document.getElementById("inputGrid")?.style.gridTemplateRows);

  ///**
  // * Add columns to a grid element
  // * @param gridId The id of the grid element to add columns to
  // * @param columns Amount of columns to add
  // */
  // function addColumns(gridId: string, columns: number) {
  //   const gridElement = document.getElementById(gridId);
  //   if (!gridElement) {
  //     return;
  //   }
  //   const match = gridElement.style.gridTemplateColumns.match(/repeat\((\d+),\s*1fr\)/);
  //   if (match) {
  //     console.log(match[1]);
  //     gridElement.style.gridTemplateColumns = `repeat(${parseInt(match[1]) + columns}, 1fr)`;
  //   }
  // }
  // // addColumns("inputForm", 4);
  // console.log(document.getElementById("inputForm")?.style.gridTemplateColumns);

  function drawGridColumn(column: number) {
    return (
      <div style={{ opacity: "50%", backgroundColor: "pink" }} key={`column-${column}`}>
        <label>item-{column}</label>
        <input type="text" name={`item-${column}`} />
      </div>
    )
  }

  let columnCount = 2;
  let columns: JSX.Element[] = [];
  for (let i = 0; i < (columnCount); i++) {
    const column = drawGridColumn(i + 1);
    columns.push(column);
  }

  // function jsxElementToString(element: JSX.Element) {
  //   console.log(element);
  //   if (element.props.style) {
  //     return `<${element.type} ${element.props.style ? `style="${getStyleString(element.props.style)}"`: ""}>${getChildrenString(element.props.children)}</${element.type}>`;
  //   }
  //   else {
  //     return `<${element.type}>${getChildrenString(element.props.children)}</${element.type}>`;
  //   }
  // }

  function getStyleString(style: { [key: string]: string }) {
    const keys = Object.keys(style);
    return keys.map((key) => `${CaseHandler.toKebabCase(key)}: ${style[key]}`).join("; ");
  }

  function getChildrenString(children: JSX.Element[]) {
    // console.log("children: ")
    // console.log(children);
    // console.log("children spread: ");
    // console.log([...children]);
    let childrenString = "";
    children.forEach((child: JSX.Element) => {
      // console.log(child);
      if (child.props && child.props.children) {
        // console.log("child has children");
        // console.log(`<${child.type}>${child.props.children.join("")}</${child.type}>`);
        childrenString += `<${child.type}>${child.props.children.join("")}</${child.type}>`;
      } else if (child.props && child.props.name && child.props.type) {
        // console.log("child has no children");
        // console.log(`<${child.type} name="${child.props.name} type="${child.props.type}"/>`)
        childrenString += `<${child.type} name="${child.props.name}" type="${child.props.type}"/>`;
      }
      // console.log(jsxElementToString(child));
    })
    return childrenString;
  }

  function generateInputGridInnerHTML() {
    return columns.map(column => `<${column.type} style="${getStyleString(column.props.style)}">${getChildrenString(column.props.children)}</${column.type}>`).join("");
  }
  function updateInputGrid(inputGridElement: HTMLElement) {
    inputGridElement.innerHTML = generateInputGridInnerHTML();
    inputGridElement.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
    if (inputGridElement) {
      inputGridElement.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent));
    } else {
      console.log("cant add event listeners when updating input grid");
    }
  }


  function addColumn() {
    console.log("Add column called");
    columnCount++;
    columns.push(drawGridColumn(columns.length + 1));
    const inputGrid = document.getElementById("inputGrid");
    if (inputGrid) {
      // inputGrid.innerHTML = generateInputGridInnerHTML()
      // inputGrid.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
      updateInputGrid(inputGrid);
    }
  }

  function removeColumn() {
    console.log("Remove column called");
    columnCount--;
    columns.pop();
    const inputGrid = document.getElementById("inputGrid");
    if (inputGrid) {
      // console.log("inputgrid innerhtml: ");
      // console.log(inputGrid.innerHTML);
      // console.log("columns: ");
      // console.log(columns.map(column => column));
      // console.log("style: ");
      // console.log(columns.map(column => column.props.style));
      // console.log("keys: ");
      // console.log(columns.map(column => Object.keys(column.props.style)));

      // console.log(columns.map(column => `<${column.type} style="${getStyleString(column.props.style)}">${getChildrenString(column.props.children)}</${column.type}>`));
      updateInputGrid(inputGrid);
    }
  }

  function insertValuesToInputGrid(values: string | string[]) {
    const valuesList = Array.isArray(values) ? values : values.split(/[\t;]/);
    columnCount = valuesList.length;
    columns = [];
    for (let i = 0; i < (columnCount ? columnCount : 4); i++) {
      columns.push(drawGridColumn(i + 1));
    }
    const gridInput = document.getElementById("inputGrid");
    if (gridInput) {
      // console.log("gridInput exists");
      updateInputGrid(gridInput);
      const inputs = gridInput.getElementsByTagName("input");
      // console.log(inputs);
      // for (const key of inputs) {
      //   console.log(key);
      //   console.log(key.value);
      // }
      valuesList.forEach((value, index) => {
        inputs[index].value = value;
        // console.log(value);
      })
    } else {
      console.log("gridInput does not exist");
    }
    // const gridInput = document.getElementById("inputGrid");
    // if (gridInput) {
    //   const inputs = gridInput.getElementsByTagName("input");
    //   values.forEach((value, index) => {
    //     inputs[index].value = value;
    //   })
    // }
  }

  function handlePaste(e: ClipboardEvent) {
    // console.log("pasting");
    // console.log("\n\n\n")
    if (!e.clipboardData) return;
    const clip = e.clipboardData.getData("text");
    // console.log(clip);
    insertValuesToInputGrid(clip);
    // const values = clip.split(/[\t;]/);
    // // console.log(values);
    // // console.log(values.length);
    // columnCount = values.length;
    // columns = [];
    // for (let i = 0; i < (columnCount ? columnCount : 4); i++) {
    //   columns.push(drawGridColumn(i + 1));
    // }
    // const gridInput = document.getElementById("inputGrid");
    // if (gridInput) {
    //   // console.log("gridInput exists");
    //   updateInputGrid(gridInput);
    //   const inputs = gridInput.getElementsByTagName("input");
    //   // console.log(inputs);
    //   // for (const key of inputs) {
    //   //   console.log(key);
    //   //   console.log(key.value);
    //   // }
    //   values.forEach((value, index) => {
    //     inputs[index].value = value;
    //     // console.log(value);
    //   })
    // } else {
    //   console.log("gridInput does not exist");
    // }
  }

  // Add event listener for pasting
  if (inputGridElement) {
    // [...inputGridElement.children].forEach((child) => {
    //   [...child.children].filter((child) => child.tagName == "INPUT").forEach((child) => { child.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent)) })
    // })
    inputGridElement.addEventListener("paste", (e) => handlePaste(e as ClipboardEvent));
  } else {
    console.log("cant add event listeners");
  }

  if (dataSeriesString) {
    insertValuesToInputGrid(dataSeriesString);
  }

  // function addInputGridColumns(columns: number) {
  //   columnCount += columns;
  // }

  // function removeInputGridColumns(columns: number) {
  //   columnCount -= columns;
  // }

  // console.log(columns);

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