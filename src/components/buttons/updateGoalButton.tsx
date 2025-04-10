'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";

export default function UpdateGoalButton({ id }: { id: string }) {
  const { t } = useTranslation();
  
  return (
    <button 
      type="button" 
      className="transparent padding-inline-100 font-weight-500 smooth seagreen color-purewhite"
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ id: id }), "POST")}
    >
      {t("components:update_goal_button.update")}
    </button>
  )
}