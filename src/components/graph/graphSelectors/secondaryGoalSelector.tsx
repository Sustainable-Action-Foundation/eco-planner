'use client';

import { useTranslation } from "react-i18next";

export default function SecondaryGoalSelector() {
  const { t } = useTranslation("graphs");

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target;
    if (!(form.secondaryGoal instanceof HTMLInputElement)) {
      return;
    }

    const secondaryGoalId = form.secondaryGoal.value;

    const target = new URL(window.location.href);
    target.searchParams.append("secondaryGoal", secondaryGoalId);

    window.location.href = target.href;
  }

  return (
    <form onSubmit={handleSubmit} className="flex-grow-100 flex gap-25 align-items-center">
      <label htmlFor="compare-goals" className="margin-left-100 font-size-14px">
        {t("graphs:secondary_graph_selector.compare_with")}:
      </label>

      <div id="compare-goals" className="focusable flex flex-grow-100 smooth">
        <input type="text" id="secondaryGoal" name="secondaryGoal" className="transparent smooth" style={{ fontSize: '.75rem', padding: '.3rem' }} />
        <button type="submit" className="font-weight-500 transparent gray-90 smooth" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} >
          {t("graphs:secondary_graph_selector.compare")}
        </button>
      </div>
    </form>
  )
}