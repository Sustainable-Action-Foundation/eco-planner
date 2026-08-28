import HistoricalForm, { HistoricalFormMode } from "@/components/form/forms/historical";
import serveTea from "@/lib/i18nServer";
import type { Metadata } from "next";
import { getEditableGoal, GoalSectionPage, goalSectionMetadata } from "../../goalSectionPage";

export async function generateMetadata(props: { params: Promise<{ goalId: string }> }): Promise<Metadata> {
  return goalSectionMetadata(props, "historical-data/create", (t, goal) => `${t("metadata:historical_data_create.title")} ${goal?.name ?? goal?.indicator_parameter ?? ""}`);
}

export default async function Page(props: { params: Promise<{ goalId: string }> }) {
  const params = await props.params;
  const [t, goal] = await Promise.all([
    serveTea("pages"),
    getEditableGoal(params.goalId),
  ]);

  return (
    <GoalSectionPage
      goal={goal}
      breadcrumb={t("pages:goal_edit.historical_create.breadcrumb")}
      title={t("pages:goal_edit.historical_create.title", { goalName: goal.name || goal.indicator_parameter })}
    >
      <HistoricalForm goal={goal} mode={HistoricalFormMode.Create} />
    </GoalSectionPage>
  );
}
