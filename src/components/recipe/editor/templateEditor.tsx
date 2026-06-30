import { useRecipe } from "@/components/recipe/context/recipeContext.use";
import { useTranslation } from "react-i18next";

export function TemplateEditor(): React.ReactElement {
  const { t } = useTranslation(["components"]);
  const { } = useRecipe();

  return (
    <div>

    </div>
  );
}