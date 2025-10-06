'use client'

import { emptyRecipe } from "@/functions/recipe-parser/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../../contextProvider";
import { useRef } from "react";
import { IconPlus } from "@tabler/icons-react";

// TODO: Rename
export function RecipeEquationEditor() {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleUpdatedEq = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const eq = e.target.value;
    if (!recipe) {
      console.warn("No recipe set, initializing with new one form the RecipeEquationEditor component");
      setRecipe({ ...emptyRecipe, eq });
    }
    else {
      setRecipe({ ...recipe, eq });
    }
  };

  const handleInsertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Use the current cursor selection
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Replace the selection with the variable key
    textarea.setRangeText('${' + key + '}', start, end, "end");

    // Fire onChange manually so your state stays in sync
    const event = new Event("input", { bubbles: true });
    textarea.dispatchEvent(event);

    textarea.focus();
  };

  return (
    <div className="flex" style={{height: '100%'}}>
      <textarea
        ref={textareaRef}
        rows={3}
        placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
        style={{
          border: '0',
          borderRadius: '.25rem 0 0 0',
          resize: 'none'
        }}
        value={recipe?.eq || ""}
        onChange={handleUpdatedEq}
      />
      <ul className="padding-inline-25 margin-0 list-style-none" style={{backgroundColor: 'var(--gray-95)', borderLeft: '1px solid var(--gray-90)'}}> {/* Todo: should be a proper menu with keycontrols */}
        {recipe?.variables &&
          Object.entries(recipe.variables).map(([key]) => (
            <li key={key} className="margin-block-25">
              <button className="width-100 flex gap-100 justify-content-space-between align-items-center" type="button" onClick={() => handleInsertVariable(key)}>
                {key} {/* TODO: Rename, what is key? */}
                <IconPlus width={16} height={16} style={{minWidth: '16px'}} />
              </button>
            </li>
          ))
        }
      </ul>
    </div>
  )
}
