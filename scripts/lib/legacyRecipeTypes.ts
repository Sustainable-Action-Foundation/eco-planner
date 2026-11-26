/**
 * Planning half of the legacy variable type rewrite (see scripts/maintenance/rewrite-legacy-recipe-types.ts).
 * Pure: takes the `Recipes.recipe` column as text and decides which rows to rewrite and to what.
 *
 * The app tolerates the old spellings when it reads a recipe (`withCurrentVariableTypes`, applied by
 * `Recipe.from`); this brings the stored rows to the current spelling so that nothing else has to.
 * Only the `type` of the affected variables changes. A row keeps its storage shape: the app stores a
 * recipe as a JSON string holding the serialized recipe, hand-written SQL has stored plain JSON objects.
 */
import { Recipe } from "@/functions/recipe/recipe";
import { withCurrentVariableTypes } from "@/functions/recipe/legacyTypes";
import type { JSONValue } from "@/types";

/** One row of `Recipes`, the recipe as the column's text (`CAST(recipe AS CHAR)`) */
export type StoredRecipe = { id: string; raw: string };

export const StoredShape = {
  /** A plain JSON object */
  Object: "OBJECT",
  /** A JSON string holding the serialized recipe, as the app writes it */
  String: "STRING",
} as const;
export type StoredShape = (typeof StoredShape)[keyof typeof StoredShape];

export type PlannedRewrite = {
  id: string;
  /** The column text the plan was made from; the write is guarded on it */
  before: string;
  after: string;
  shape: StoredShape;
  /** Variables rewritten, per legacy spelling */
  replaced: Record<string, number>;
  isManual: boolean;
};

export type LegacyTypePlan = {
  scanned: number;
  rewrites: PlannedRewrite[];
  /** Rows with a legacy spelling that do not parse even with it rewritten: listed, never written */
  stillInvalid: { id: string; reason: string }[];
  /** Rows without a legacy spelling that the current code cannot parse either: listed, never written */
  otherwiseInvalid: { id: string; reason: string }[];
};

type JSONObject = Partial<{ [key: string]: JSONValue }>;

function isJSONObject(value: JSONValue | undefined): value is JSONObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function variablesOf(recipe: JSONValue): JSONValue[] {
  return isJSONObject(recipe) && Array.isArray(recipe.variables) ? recipe.variables : [];
}

function typeOf(variable: JSONValue | undefined): string | null {
  return isJSONObject(variable) && typeof variable.type === "string" ? variable.type : null;
}

/** Why the current code rejects the recipe, or null when it parses */
function parseFailure(recipe: JSONValue): string | null {
  try {
    Recipe.from(recipe);
    return null;
  }
  catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function planLegacyTypeRewrites(rows: StoredRecipe[]): LegacyTypePlan {
  const plan: LegacyTypePlan = { scanned: rows.length, rewrites: [], stillInvalid: [], otherwiseInvalid: [] };

  for (const row of rows) {
    let recipe: JSONValue;
    let shape: StoredShape = StoredShape.Object;
    try {
      recipe = JSON.parse(row.raw) as JSONValue;
      if (typeof recipe === "string") {
        shape = StoredShape.String;
        recipe = JSON.parse(recipe) as JSONValue;
      }
    }
    catch {
      plan.otherwiseInvalid.push({ id: row.id, reason: "not valid JSON" });
      continue;
    }

    const current = withCurrentVariableTypes(recipe);
    const reason = parseFailure(current);
    if (current === recipe) {
      if (reason !== null) plan.otherwiseInvalid.push({ id: row.id, reason });
      continue;
    }
    if (reason !== null) {
      plan.stillInvalid.push({ id: row.id, reason });
      continue;
    }

    const replaced: Record<string, number> = {};
    const rewrittenVariables = variablesOf(current);
    variablesOf(recipe).forEach((variable, index) => {
      const legacyType = typeOf(variable);
      if (legacyType !== null && legacyType !== typeOf(rewrittenVariables[index])) {
        replaced[legacyType] = (replaced[legacyType] ?? 0) + 1;
      }
    });

    const serialized = JSON.stringify(current);
    plan.rewrites.push({
      id: row.id,
      before: row.raw,
      after: shape === StoredShape.String ? JSON.stringify(serialized) : serialized,
      shape,
      replaced,
      isManual: isJSONObject(current) && isJSONObject(current.meta) && current.meta.isManual === true,
    });
  }

  return plan;
}

function sqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
}

/**
 * One transaction that rewrites every planned row. Each update is guarded on the text the plan was
 * made from, so a recipe saved in the meantime is left alone and running the file twice changes nothing.
 */
export function legacyTypePlanToSql(plan: LegacyTypePlan): string {
  const lines: string[] = [
    `-- Rewrites legacy variable types in ${plan.rewrites.length} recipes (of ${plan.scanned} scanned).`,
    "START TRANSACTION;",
  ];
  for (const rewrite of plan.rewrites) {
    lines.push(`UPDATE \`Recipes\` SET \`recipe\` = ${sqlString(rewrite.after)} WHERE \`id\` = ${sqlString(rewrite.id)} AND \`recipe\` = ${sqlString(rewrite.before)};`);
  }
  lines.push("COMMIT;");
  return lines.join("\n") + "\n";
}

function count<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

function listed(title: string, rows: { id: string; reason: string }[], limit = 20): string[] {
  if (rows.length === 0) return [];
  return [
    title,
    ...rows.slice(0, limit).map(row => `  ${row.id}: ${row.reason}`),
    ...(rows.length > limit ? [`  ... and ${rows.length - limit} more`] : []),
  ];
}

/** Plain-text counts for a human skim before anything is written */
export function legacyTypePlanToReport(plan: LegacyTypePlan): string {
  const { rewrites } = plan;
  const perSpelling = new Map<string, { recipes: number; variables: number }>();
  for (const rewrite of rewrites) {
    for (const [legacyType, variables] of Object.entries(rewrite.replaced)) {
      const entry = perSpelling.get(legacyType) ?? { recipes: 0, variables: 0 };
      perSpelling.set(legacyType, { recipes: entry.recipes + 1, variables: entry.variables + variables });
    }
  }

  const lines: string[] = [
    `${plan.scanned} recipes scanned`,
    `${rewrites.length + plan.stillInvalid.length} store a legacy variable type, ${rewrites.length} to rewrite`,
  ];
  for (const [legacyType, entry] of perSpelling) {
    lines.push(`  "${legacyType}": ${entry.variables} variables in ${entry.recipes} recipes`);
  }
  if (rewrites.length > 0) {
    lines.push(
      `  manual (meta.isManual): ${count(rewrites, rewrite => rewrite.isManual)}, other: ${count(rewrites, rewrite => !rewrite.isManual)}`,
      `  stored as a JSON object: ${count(rewrites, rewrite => rewrite.shape === StoredShape.Object)}, as a JSON string: ${count(rewrites, rewrite => rewrite.shape === StoredShape.String)}`,
    );
  }
  lines.push(
    ...listed(`${plan.stillInvalid.length} with a legacy type do not parse even when it is rewritten (left alone):`, plan.stillInvalid),
    ...listed(`${plan.otherwiseInvalid.length} other recipes do not parse with the current code (no legacy type involved, left alone):`, plan.otherwiseInvalid),
  );
  return lines.join("\n") + "\n";
}
