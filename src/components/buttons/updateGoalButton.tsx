'use client';

import formSubmitter from "@/functions/formSubmitter";

export default function UpdateGoalButton({ id }: { id: string }) {
  return (
    <button type="button" className="transparent padding-inline-100 font-weight-500 smooth seagreen color-purewhite"
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}>
      Uppdatera målbana
    </button>
  )
}