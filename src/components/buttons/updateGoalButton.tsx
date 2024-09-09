'use client';

import formSubmitter from "@/functions/formSubmitter";

export default function UpdateGoalButton({ id }: { id: string }) {
  return (
    <button type="button" className="transparent flex gap-50 padding-50"
      style={{ fontSize: '1rem', fontWeight: '500', lineHeight: '1.5' }}
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}>
      Uppdatera målbanan
    </button>
  )
}