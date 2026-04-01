import TabList from "@/components/generic/tablist/tabList";
import { OutputDataSeries, OutputGraph, useRecipe } from "@/components/recipe";
import { useTranslation } from "react-i18next";

export function CombinedStatusDisplay() {
  const { recipe } = useRecipe();
  const { t } = useTranslation("components");

  return (
    <TabList
      defaultIndex={0}
      styling="simple"
      props={{
        className: "margin-top-200",
      }}
    >
      <div
        data-tabname={t("components:recipe_editor.data_series")}
        className="padding-top-50 margin-bottom-100"
      >
        <OutputDataSeries />
      </div>
      <div
        data-tabname={t("components:recipe_editor.graph")}
        className="padding-top-50 margin-bottom-100"
      >
        <OutputGraph />
      </div>
      <div
        data-tabname={t("components:recipe_editor.equation")}
        className="padding-top-50 margin-bottom-100"
      >
        <p className="margin-0">{recipe?.equation}</p>
      </div>
    </TabList>
  );
}