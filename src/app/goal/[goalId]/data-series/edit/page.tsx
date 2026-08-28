import DataSeriesForm from "@/components/form/forms/dataSeries";
import serveTea from "@/lib/i18nServer";
import type { Metadata } from "next";
import { getEditableGoal, GoalSectionPage, goalSectionMetadata } from "../../goalSectionPage";

export async function generateMetadata(props: { params: Promise<{ goalId: string }> }): Promise<Metadata> {
  return goalSectionMetadata(props, "data-series/edit", (t, goal) => `${t("metadata:goal_edit.title")} ${goal?.name ?? goal?.indicator_parameter ?? ""}`);
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
      breadcrumb={t("pages:goal_edit.data_series.breadcrumb")}
      title={t("pages:goal_edit.data_series.title", { goalName: goal.name || goal.indicator_parameter })}
    >
      <DataSeriesForm goal={goal} />
    </GoalSectionPage>
  );
}
