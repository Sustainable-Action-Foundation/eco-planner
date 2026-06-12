import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";

export default function UnitSync({
  setter,
}: {
  setter: React.Dispatch<React.SetStateAction<string>>
}) {
  const { resultingUnit } = useRecipe();
  const { t } = useTranslation("components");

  if (!resultingUnit) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setter(resultingUnit);
      }}
    >
      {t("components:recipe_editor.apply_unit")}
    </button>
  );
}