import TabList from "@/components/generic/tablist/tabList";
import { ResultingRecipe } from "./output/output";
import OutputGraph from "./output/graph";
import OutputDataSeries from "./output/dataSerie";
import OutputStatus from "./output/status";
import RecipeEquationEditor from "@/components/recipe/editor/equation/editor";
import VariableCreator from "./variable/creator";
import VariableEditor from "@/components/recipe/editor/variable/editor";
import { useTranslation } from "react-i18next";

export default function RecipeEditor() {
  const { t } = useTranslation(["components"]);

  return (
    <>
      <TabList defaultIndex={1} menuItems={<VariableCreator allowAddVariables={true} />}>
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
        <div className="">
          <p style={{ textDecoration: "underline" }}>
            {t("components:recipe_editor.status")}
          </p>
            <OutputStatus />
            <OutputGraph />
          <OutputDataSeries />
          </div>
      </div>

        {/* TODO: What is this? */}
        {/*  
          When reading the output of the recipe context it's done via this form element which can be read by a parent form.
          The reason it's exposed like this is for developer transparency so you can set the name and stuff yourself but I'm open to feedback on this approach.
          - Vena 
        */}
        <ResultingRecipe FormElement={<input type="hidden" name="resultingRecipe" />} />
    </>
  )
}