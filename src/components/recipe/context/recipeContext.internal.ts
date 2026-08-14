import type { RecipeContextType } from "@/components/types";
import { createContext } from "react";

export const RecipeContext = createContext<RecipeContextType | null>(null);
