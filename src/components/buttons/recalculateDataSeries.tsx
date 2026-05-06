'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";

export default function RecalculateDataSeriesButton({
  label,
  dataSeriesId,
}: {
  label: string;
  dataSeriesId: string;
}) {
  const { t } = useTranslation("components");

  if (!dataSeriesId) {
    throw new Error("Data series ID is required to recalculate data series");
  }

  return (
    <button
      type="button"
      className="transparent padding-inline-100 font-weight-500 smooth seagreen color-purewhite"
      onClick={() => formSubmitter('/api/recalculate', JSON.stringify({ dataSeriesId }), "POST", t)}
    >
      {label}
    </button>
  );
}