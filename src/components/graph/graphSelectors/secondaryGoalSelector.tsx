'use client';

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export default function SecondaryGoalSelector() {
  const { t } = useTranslation("graphs");

  const defaultSecondaryGoal = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("secondaryGoal") ?? "";
  }, []);

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target;
    const input = form.elements.namedItem("compare-goals");

    if (!(input instanceof HTMLInputElement)) return;

    const secondaryGoalId = input.value.trim();

    const target = new URL(window.location.href);

    if (secondaryGoalId === "") {
      target.searchParams.delete("secondaryGoal");
    } else {
      target.searchParams.set("secondaryGoal", secondaryGoalId);
    }

    window.location.href = target.href;

  }

  return (
    <form onSubmit={handleSubmit} className="flex-grow-infinity flex gap-25 align-items-center">
      <div className="floating-label focusable smooth flex-grow-100 flex align-items-center" style={{ "--background": "linear-gradient(var(--gray-95) 50%, white 100%)" } as React.CSSProperties}>
        <label htmlFor="compare-goals">
          {t("graphs:secondary_graph_selector.compare_with")}
        </label>
        <input
          type="text"
          id="compare-goals"
          name="compare-goals"
          placeholder=" "
          className="font-size-75"
          style={{ padding: '.3rem' }}
          defaultValue={defaultSecondaryGoal}
        />
        <button type="submit" className="font-size-75" style={{padding: '.3rem .6rem', borderRadius: '0 .25rem .25rem 0', backgroundColor: 'var(--gray-90)', borderLeft: '1px solid var(--gray-80)', transform: 'scale(1)' }} >
          {t("graphs:secondary_graph_selector.compare")}
        </button>
      </div>
    </form>
  )
}