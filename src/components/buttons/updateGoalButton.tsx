'use client';

import formSubmitter from "@/functions/formSubmitter";
import dict from "./updateGoalButton.dict.json" assert { type: "json" };
import { useClientLocale, validateDict } from "@/functions/clientLocale";

export default function UpdateGoalButton({ id }: { id: string }) {
  validateDict(dict);
  const locale = useClientLocale();

  return (
    <button type="button" className="transparent flex gap-50 padding-50 font-weight-500"
      style={{ fontSize: '1rem', lineHeight: '1.5' }}
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}>
      {dict.updateGoal[locale]}
    </button>
  )
}