'use client';

import formSubmitter from "@/functions/formSubmitter";

export default function UpdateGoalButton({ id }: { id: string }) {
  return (
    <button type="button" className="transparent flex gap-50 padding-50 font-weight-500"
      style={{ fontSize: '1rem', lineHeight: '1.5' }}
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}>
      Uppdatera målbanan
    </button>
  )
}