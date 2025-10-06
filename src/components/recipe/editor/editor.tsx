import TabList from "@/components/generic/tablist/tabList";
import { RecipeErrorAndWarnings, ResultingDataSeries, ResultingGraph, ResultingRecipe } from "./output/output";
import { RecipeVariableEditor } from "@/components/recipe/editor/variables/variable";
import { RecipeEquationEditor } from "@/components/recipe/editor/equation/equation";

export default function RecipeEditor() {
  return (
    <>
      <TabList defaultIndex={1}>
        <div
          data-tabname="Recept"
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
          data-tabname="Variabler"
          className="purewhite padding-25 flex flex-direction-column"
          style={{ border: '1px solid var(--gray)', borderRadius: '.25rem .25rem 0 0', minHeight: '300px', resize: 'vertical', overflow: 'auto', backgroundColor: 'white' }}
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
          
      <div
        className="padding-50"
        style={{backgroundColor: 'var(--gray-95)', border: '1px solid var(--gray)', borderRadius: '0 0 .25rem .25rem'}}
      >
        <TabList
          defaultIndex={0}
          styling="simple"
        >
          <div
            data-tabname="problem" // TODO: Show a count of the problems // TODO: Rename, validering? // TODO: Show fallback if there is no problem
            className="padding-top-50"
          >
            <RecipeErrorAndWarnings />
          </div>
          <div
            data-tabname="dataserie"
            className="padding-top-50" // TODO: Show fallback if there is  no resultingdata-series
          >
            <ResultingDataSeries FormElement={<input type="hidden" name="resultingDataSeries" />} />
          </div>
          <div
            data-tabname="graph"// TODO: Show fallback if there is  no resultingdata-series
            className="padding-top-50" 
          >
            <ResultingGraph />
          </div>
        </TabList>
      </div>
      
      <label className="width-100">
        <ResultingRecipe FormElement={<input type="hidden" name="resultingRecipe" />} /> {/* TODO: What is this? */}
      </label>

      {/* <DEBUG_Recipe /> */}
    </>
  )
}