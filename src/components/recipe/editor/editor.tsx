import TabList from "@/components/generic/tablist/tabList";
import OutputGraph from "./output/graph";
import OutputDataSeries from "./output/dataSeries";
import OutputStatus from "./output/status";
import RecipeEquationEditor from "@/components/recipe/editor/equation/editor";
import VariableCreator from "./variable/creator";
import VariableEditor from "@/components/recipe/editor/variable/editor";
import { useTranslation } from "react-i18next";
import FormIntegration from "./output/formIntegration";

export default function RecipeEditor() {
  const { t } = useTranslation(["components"]);

  return (
    <>
      <TabList defaultIndex={0} menuItems={<VariableCreator allowAddVariables={true} />}>
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
            allowAddVariables
            allowDeleteVariables
            allowNameEditing
            allowTypeEditing
            allowValueEditing
          />
        </div>
      </TabList>

      <div
        className="padding-50"
        style={{ backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray)', borderTop: '0', borderRadius: '0 0 .25rem .25rem' }}
      >
        <TabList
          defaultIndex={0}
          styling="simple"

        >
          <div
            data-tabname={t("components:recipe_editor.graph")}
            className="padding-top-50"
          >
            <OutputStatus />
            <OutputGraph />
          </div>
          <div
            data-tabname={t("components:recipe_editor.data_series")}
            className="padding-top-50"
          >
            <OutputStatus />
            <OutputDataSeries />
          </div>
        </TabList>
      </div>

      <FormIntegration
        RecipeFormElement={<input name="resultingRecipe" />}
      />
    </>
  )
}