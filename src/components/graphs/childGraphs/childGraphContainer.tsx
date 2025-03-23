"use client"

import { DataSeries, Effect, Goal } from "@prisma/client";
import GoalChildGraph from "./goalChildGraph";
import PredictionChildGraph from "./predictionChildGraph.tsx";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getStoredChildGraphType } from "../functions/graphFunctions";
import { percentAndFraction } from "../graphselector/graphSelector";
import ChildGraphSelector from "../graphselector/childGraphSelector";

export enum ChildGraphType {
  Target = "TARGET",
  Prediction = "PREDICTION",
}

export default function ChildGraphContainer({
  goal,
  childGoals,
  children,
}: {
  goal: Goal & { dataSeries: DataSeries | null },
  childGoals: (Goal & { dataSeries: DataSeries | null, baselineDataSeries: DataSeries | null, effects: (Effect & { dataSeries: DataSeries | null })[], roadmapName?: string })[],
  children?: React.ReactNode,
}) {
  const [childGraphType, setChildGraphType] = useState<ChildGraphType>(ChildGraphType.Target);
  // Default to stacked unless the unit is percent or fraction
  const [isStacked, setIsStacked] = useState(!percentAndFraction.includes(goal.dataSeries?.unit?.toLowerCase() ?? ""));

  useEffect(() => {
    const storedGraphType = getStoredChildGraphType(goal.id);
    if (Object.values(ChildGraphType).includes(storedGraphType)) {
      setChildGraphType(storedGraphType);
    }
  }, [goal.id]);

  function childGraphSwitch(childGraphType: string) {
    switch (childGraphType) {
      case ChildGraphType.Target:
        return <GoalChildGraph goal={goal} childGoals={childGoals} isStacked={isStacked} />
      case ChildGraphType.Prediction:
        return <PredictionChildGraph goal={goal} childGoals={childGoals} isStacked={isStacked} />
      default:
        return childGraphSwitch(ChildGraphType.Target);
    }
  };

  return (
    <>
      <menu className="flex align-items-flex-end gap-25 margin-0 margin-block-25 padding-0 flex-wrap-wrap" >
        <ChildGraphSelector goal={goal} currentSelection={childGraphType} setter={setChildGraphType} />
        <button 
          className="display-flex align-items-center gap-50 gray-90 font-weight-500" 
          style={{ width: 'fit-content', fontSize: '.75rem', padding: '.3rem .6rem' }} 
          type="button" onClick={() => setIsStacked(!isStacked)}
        >
          Byt graftyp
          <Image src='/icons/chartArea.svg' alt='Byt graf' width={16} height={16} />
        </button>
        {children}
      </menu>
      <article className="smooth padding-inline-25 padding-bottom-50 purewhite" style={{border: '1px solid var(--gray)'}}>
        <h2 className="text-align-center block font-weight-500 margin-block-200" style={{fontSize: '1rem'}}>
          Målbanor som jobbar mot {goal.name ? `${goal.name}` : `${goal.indicatorParameter}`}
        </h2>
        <div style={{ height: '500px' }}>
          {childGraphSwitch(childGraphType)}
        </div>
      </article>
    </>
  );
}