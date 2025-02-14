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
    <div className="smooth purewhite" style={{ border: '1px solid var(--gray-90)', paddingInline: '.3rem' }}>
      <menu
        className="flex align-items-center gap-25 margin-0 margin-bottom-25 padding-0 flex-wrap-wrap"
        style={{ borderBottom: '1px solid var(--gray-90)', paddingBlock: '.3rem' }}
      >
        <ChildGraphSelector goal={goal} currentSelection={childGraphType} setter={setChildGraphType} />
        <button className="call-to-action-primary display-flex align-items-center gap-50 transparent" style={{ width: 'fit-content', fontWeight: 'bold', fontSize: '1rem' }} type="button" onClick={() => setIsStacked(!isStacked)}>
          Byt typ av graf
          <Image src='/icons/chartArea.svg' alt='Byt graf' width={24} height={24} />
        </button>
        {children}
      </menu>
      <div className="margin-bottom-25" style={{ height: '500px' }}>
        {childGraphSwitch(childGraphType)}
      </div>
    </div>
  );
}