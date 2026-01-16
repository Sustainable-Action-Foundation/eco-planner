import crypto from "node:crypto";
import { Recipe } from "./types";

export function hashRecipe(recipe: Recipe): string {
  const input = JSON.stringify(recipe);
  const hashObject = crypto.createHash("sha256");
  hashObject.update(input);
  return hashObject.digest("hex");
}
