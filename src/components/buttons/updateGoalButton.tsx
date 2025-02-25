'use client';

import formSubmitter from "@/functions/formSubmitter";
import dict from "./updateGoalButton.dict.json" with { type: "json" };
import { useContext } from "react";
import { LocaleContext } from "@/app/context/localeContext.tsx";

export default function UpdateGoalButton({ id }: { id: string }) {
  const locale = useContext(LocaleContext);

  return (
    <button type="button" className="transparent flex gap-50 padding-50 font-weight-500"
      style={{ fontSize: '1rem', lineHeight: '1.5' }}
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}>
      {dict.updateGoal[locale]}
    </button>
  )
}