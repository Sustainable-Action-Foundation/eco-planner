'use client'

import { emptyRecipe } from "@/functions/recipe/types";
import { useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.provider";
import React, { useRef, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

export default function EquationEditor() {
  const { t } = useTranslation("components");
  const { recipe, setRecipe } = useRecipe();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

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
    <div className="flex" style={{ minHeight: '225px', height: '100%' }}>
      <textarea
        ref={textareaRef}
        rows={3}
        placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
        style={{
          border: '0',
          borderRadius: '0',
          resize: 'none'
        }}
        value={recipe?.eq || ""}
        onChange={handleUpdatedEq}
      />
      <ul
        role="menu"
        tabIndex={0}
        className="padding-25 padding-inline-50 margin-0 list-style-none"
        style={{ backgroundColor: 'var(--gray-95)', borderLeft: '1px solid var(--gray-90)' }}
        aria-activedescendant={focusedIndex !== null ? `variable-menu-menuitem-${focusedIndex}` : ''}
        onKeyDown={(e: React.KeyboardEvent<HTMLUListElement>) => { // TODO: This is not working, try and structure stuff before tackling this. That way we can probably abstract the combobox functions and reuse some stuff
          if (e.key == "arrowDown") {
            console.log(focusedIndex)
            if (focusedIndex !== null) {
              setFocusedIndex(focusedIndex + 1)
            } else {
              setFocusedIndex(0)
            }

            e.preventDefault()
          }
        }}
      >
        {/* Todo: should be a proper menu with keycontrols */}
        {recipe?.variables ?
          <>
            <h2 className="font-weight-normal text-align-center margin-block-25 padding-bottom-25" style={{ fontSize: '14px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--gray)' }}>Infoga variabel</h2>
            {recipe?.variables &&
              Object.entries(recipe.variables).map(([key], index) => (
                <li key={key} role="presentation">
                  <button
                    id={`variable-menu-menuitem-${index}`}
                    tabIndex={-1}
                    role="menuitem"
                    className="transparent padding-25 width-100 flex gap-100 justify-content-space-between align-items-center"
                    type="button"
                    onClick={() => handleInsertVariable(key)}
                  >
                    {key} {/* TODO: Rename, what is key? */}
                    <IconPlus width={16} height={16} strokeWidth={1.5} style={{ minWidth: '16px' }} />
                  </button>
                </li>
              ))
            }
          </>
          : null}
      </ul>
    </div>
  )
}
