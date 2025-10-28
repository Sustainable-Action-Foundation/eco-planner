"use client"

import { ReactElement, } from "react";
import { useRecipe } from "../../contextProvider";

// TODO: Rename/remove (what is this even)
export function ResultingRecipe({ FormElement }: { FormElement: ReactElement }) {
  const { recipe } = useRecipe();

  if (!recipe) {
    return null;
  }

  return (<>
    <label>
      <FormElement.type {...(FormElement.props || {})} value={JSON.stringify(recipe)} />
    </label>
  </>);
}

