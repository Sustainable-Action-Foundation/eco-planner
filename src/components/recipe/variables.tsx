import { RecipeVariableType } from "@/functions/recipe-parser/types";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

function CommonVariable({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation("components");

  return <li style={{
    display: 'flex',
    columnGap: '1ch',
  }}>
    {/* Variable name */}
    <input type="text" placeholder={t("components:copy_and_scale.variable_name_placeholder")} style={{ width: '17ch' }} />

    {/* Data type */}
    <select>
      <option value={RecipeVariableType.DataSeries}>{t("components:copy_and_scale.data_series")}</option>
      <option value={RecipeVariableType.External}>{t("components:copy_and_scale.external_data")}</option>
      <option value={RecipeVariableType.Scalar}>{t("components:copy_and_scale.scalar")}</option>
    </select>

    {/* Variable specific inputs */}
    {children}

    {/* Unit */}
    <input type="text" placeholder={t("components:copy_and_scale.variable_unit_placeholder")} style={{ width: '10ch' }} />

    {/* Delete */}
    <button type="button" style={{
      width: '5ch',
      backgroundColor: 'red',
      color: 'white',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <IconX strokeWidth={3} />
    </button>
  </li>;
}

export function ScalarVariable() {
  return <CommonVariable>

  </CommonVariable>;
}

export function DataSeriesVariable() {
  return <CommonVariable>

  </CommonVariable>;
}

export function ExternalVariable() {
  return <CommonVariable>

  </CommonVariable>;
}