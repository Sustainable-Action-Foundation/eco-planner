import TabList from "@/components/generic/tabview/tabList";
import { RecipeErrorAndWarnings, ResultingDataSeries, ResultingRecipe } from "./output";
import { RecipeVariableEditor } from "@/components/recipe/editor/variable";
import { RecipeEquationEditor } from "@/components/recipe/editor/equation";

export default function RecipeEditor() {
  return (
    <>
      <div
        className="smooth"
        style={{ backgroundColor: 'white', border: '1px solid var(--gray)' }}
      >
        <TabList
          defaultIndex={1}
          props={{
            className: "padding-25",
            style: {
              borderRadius: '.25rem .25rem 0 0',
              borderBottom: '1px solid var(--gray)',
              backgroundColor: 'var(--gray-95)'
            }
          }}
        >
          <div
            role="tabpanel"
            data-tabname="Recept"
            id="equation-editor-panel"
            aria-labelledby="equation-editor-tab"
          >
            <RecipeEquationEditor />
          </div>
          <div
            role="tabpanel"
            data-tabname="Variabler"
            id="variable-editor-panel"
            aria-labelledby="variable-editor-tab"
            className="purewhite padding-25 flex flex-direction-column"
            style={{ minHeight: '300px', resize: 'vertical', overflow: 'auto' }}
          >
            <RecipeVariableEditor
              allowAddVariables
              allowDeleteVariables
              allowNameEditing
              allowTypeEditing
              allowValueEditing
            />
          </div>
        </TabList>
        {/* A list of all variables goes here. */}
        <div
          style={{
            borderTop: '1px solid var(--gray)',
            backgroundColor: 'var(--gray-95)',
            padding: ".25rem",
            borderRadius: '0 0 .25rem .25rem'
          }}
        >
          { /*
                  TODO: Add graph to tablist
                */ }
          <TabList
            defaultIndex={0}
            styling="simple"
            props={{
              className: "padding-block-25 margin-bottom-25 flex",

            }}
          >
            <div
              role="tabpanel"
              data-tabname="problem" // TODO: Show a count of the problems // TODO: Rename, validering?
              id="problem-panel"
              aria-labelledby="problem-tab"
              className="padding-25 padding-top-50"
              style={{ borderTop: '1px solid var(--gray)' }} // TODO: Show fallback if there is no problem
            >
              <RecipeErrorAndWarnings />
            </div>
            <div
              role="tabpanel"
              data-tabname="dataserie"
              id="dataserie-panel"
              aria-labelledby="dataserie-tab"
              className="padding-25 padding-top-50" // TODO: Show fallback if there is  no resultingdata-series
              style={{ borderTop: '1px solid var(--gray)' }}
            >
              <ResultingDataSeries FormElement={<input type="hidden" name="resultingDataSeries" />} />
            </div>
          </TabList>
        </div>
      </div>

      <label className="width-100">
        <ResultingRecipe FormElement={<input type="hidden" name="resultingRecipe" />} /> {/* TODO: What is this? */}
      </label>

      {/* <DEBUG_Recipe /> */}
    </>
  )
}