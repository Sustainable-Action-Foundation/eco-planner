import "client-only";
import TabList from "@/components/generic/tablist/tabList";
import OutputGraph from "./output/graphDisplay";
import OutputDataSeries from "./output/dataSeriesDisplay";
import OutputStatus from "./output/statusDisplay";
import RecipeEquationEditor from "@/components/recipe/editor/equationEditor";
import VariableCreator from "./variables/variableCreator";
import VariableEditor from "@/components/recipe/editor/variables/variableEditor";
import { useTranslation } from "react-i18next";
import FormIntegration from "./output/formIntegration";

export default function RecipeEditor() {
  const { t } = useTranslation(["components"]);

  return (
    <>
      <TabList
        defaultIndex={0}
        menuItems={<VariableCreator allowAddVariables={true} />}
      >
        <div
          data-tabname={t("components:recipe_editor.recipe")}
          style={{
            resize: 'vertical',
            overflow: 'auto',
            border: '1px solid var(--gray)',
            borderRadius: '0 .25rem 0 0'
          }}
        >
          <RecipeEquationEditor />
        </div>
        <div
          data-tabname={t("components:recipe_editor.variables")}
          className="purewhite padding-25 flex flex-direction-column"
          style={{ border: '1px solid var(--gray)', borderRadius: '.25rem .25rem 0 0', minHeight: '225px', resize: 'vertical', overflow: 'auto', backgroundColor: 'white' }}
        >
          <VariableEditor
            permissions={{
              allowAddVariables: true,
              allowDeleteVariables: true,
              allowNameEditing: true,
              allowTypeEditing: true,
              allowValueEditing: true,
            }}
          />
        </div>
      </TabList>

      <div
        className="padding-50"
        style={{ backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray)', borderTop: '0', borderRadius: '0 0 .25rem .25rem' }}
      >
        <OutputStatus />

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
        </TabList>
      </div>

      <FormIntegration
        RecipeFormElement={<input name="resultingRecipe" />}
      />
    </>
  )
}