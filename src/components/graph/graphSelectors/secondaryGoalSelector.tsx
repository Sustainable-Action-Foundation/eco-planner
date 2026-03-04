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
      <div className="floating-label focusable smooth flex-grow-100 flex align-items-center" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="compare-goals">
          {t("graphs:secondary_graph_selector.compare_with")}
        </label>
        <input type="text" id="compare-goals" name="compare-goals" placeholder=" " style={{ fontSize: '.75rem', padding: '.3rem' }} />
        <button type="submit" className="font-weight-500 transparent gray-90 smooth" style={{ fontSize: '.75rem', padding: '.3rem .6rem' }} >
          {t("graphs:secondary_graph_selector.compare")}
        </button>
      </div>
    </form>
  )
}

{/*
<div className="floating-label" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
  <label htmlFor={`variable-name-${variableName}`}>
    {t("components:recipe_editor.variable_name_placeholder")}
  </label>
  <input
    id={`variable-name-${variableName}`}
    placeholder=" "
    style={{ gridRow: '1', gridColumn: '1' }}
    defaultValue={variableName}
    onChange={(e) => updateVariableName(variableName, e.target.value, setVariables)}
    type="text"
  />
</div>
 */} 