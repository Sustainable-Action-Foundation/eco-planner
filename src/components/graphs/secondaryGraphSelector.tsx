'use client';

import { useTranslation } from "react-i18next";

export default function SecondaryGoalSelector() {
  const { t } = useTranslation();
  
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target;
    const secondaryGoalId = form.secondaryGoal.value;

    const target = new URL(window.location.href);
    target.searchParams.append("secondaryGoal", secondaryGoalId);

    window.location.href = target.href;
  }
  
  return (
    <>
      <form onSubmit={handleSubmit} className="flex-grow-100">
        <div className="focusable flex" style={{borderRadius: '2px', backgroundColor: 'var(--gray-90)'}}>
          <input 
            type="text" 
            id="secondaryGoal" 
            name="secondaryGoal" 
            className="transparent" 
            style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}} 
            placeholder={t("components:secondary_graph_selector.goal_id_placeholder")}
          />
          <button 
            type="submit" 
            className="font-weight-500 transparent" 
            style={{fontSize: '.75rem', borderRadius: '2px', padding: '.3rem .6rem'}}
          >
            {t("components:secondary_graph_selector.compare")}
          </button>
        </div>
      </form>
    </>
  )
}