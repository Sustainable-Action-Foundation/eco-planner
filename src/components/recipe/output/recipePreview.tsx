// Intentionally not a "use client" entry: this is a client-tree leaf rendered
// only within client components (e.g. SuggestedRecipesList). Marking it "use
// client" would make it a server/client boundary and force its props to be
// serializable, which a `Recipe` class instance is not.
import type { Recipe } from "@/functions/recipe/recipe";
import type { RecipeVariable } from "@/functions/recipe/types";
import { RecipeDataTypes } from "@/functions/recipe/types";
import React from "react";

/** Splits an equation into literal segments and `${token}` placeholders. */
const placeholderSplitRegex = /(\$\{[^}]+\})/g;
const placeholderTokenRegex = /^\$\{([^}]+)\}$/;

/** Outlined "chip" look shared by equation placeholders and the variable list, so a name reads the same in both. */
const variableChipStyle: React.CSSProperties = {
  backgroundColor: "var(--gray-95)",
  border: "1px solid var(--gray-80)",
  borderRadius: "4px",
  padding: "0.1rem 0.35rem",
  whiteSpace: "nowrap",
};

/** One-line, human-readable summary of where a variable's value comes from. */
function variableSummary(variable: RecipeVariable): string {
  switch (variable.type) {
    case RecipeDataTypes.Scalar: {
      return variable.unit ? `${variable.value} ${variable.unit}` : `${variable.value}`;
    }
    case RecipeDataTypes.DataSeries: {
      const source = variable.externalSource
        ? `${variable.externalSource.dataset ?? "external"}/${variable.externalSource.tableId ?? "?"}`
        : "data series";
      return `${source} · pick: ${String(variable.pick)}`;
    }
    case RecipeDataTypes.External: {
      const source = `${variable.dataset ?? "external"}/${variable.tableId ?? "?"}`;
      return `${source} · pick: ${String(variable.pick)}`;
    }
    default: {
      return (variable as RecipeVariable).type;
    }
  }
}

/**
 * Pretty, read-only preview of a recipe: the equation with its `${token}`
 * placeholders rendered as named chips, followed by a list of its variables and
 * where each comes from. Renders the body only — callers supply their own header
 * (e.g. the recipe name).
 */
export function RecipePreview({
  recipe,
}: {
  recipe: Recipe;
}): React.ReactElement {
  // Resolve a placeholder token (variable id, or display name for legacy/suggested recipes) to its name.
  const byId = recipe.variableMap;
  const resolveName = (token: string): string =>
    byId[token]?.name ?? recipe.variables.find(v => v.name === token)?.name ?? token;

  const segments = recipe.equation.split(placeholderSplitRegex).filter(segment => segment !== "");

  return (
    <div className="flex flex-direction-column gap-50" style={{ fontSize: "14px" }}>
      {/* Equation with placeholders as chips */}
      {recipe.equation.trim() !== "" && (
        <p className="margin-0" style={{
          lineHeight: "1.8",
          backgroundColor: "var(--gray-95)",
          padding: "0.5rem 0.75rem",
          borderRadius: "4px",
        }}>
          {segments.map((segment, index) => {
            const token = placeholderTokenRegex.exec(segment);
            if (token) {
              return (
                <span key={index} style={{ ...variableChipStyle, margin: "0 0.1rem" }}>
                  {resolveName(token[1])}
                </span>
              );
            }
            return <React.Fragment key={index}>{segment}</React.Fragment>;
          })}
        </p>
      )}

      {/* Variable list */}
      {recipe.variables.length > 0 && (
        <ul className="margin-0 padding-0 list-style-none flex flex-direction-column gap-25">
          {recipe.variables.map(variable => (
            <li key={variable.id} className="flex gap-50 align-items-baseline">
              <span style={variableChipStyle}>{variable.name}</span>
              {/* Dotted leader connecting the name to its summary across the gap. */}
              <span
                aria-hidden="true"
                style={{
                  flex: "1 1 auto",
                  minWidth: "1rem",
                  alignSelf: "center",
                  borderBottom: "1px dotted var(--gray-80)",
                }}
              />
              <span style={{ color: "var(--gray-50)", whiteSpace: "nowrap", textAlign: "right" }}>
                {variableSummary(variable)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
