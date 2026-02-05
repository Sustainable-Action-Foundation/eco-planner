import "server-only";
import { goalInclusionSelection } from "@/fetchers/inclusionSelectors";
import { getSession, LoginData } from "@/lib/session"
import prisma from "@/prismaClient";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { Recipe } from "@/functions/recipe/types";
import { SmartRecipe } from "@/functions/recipe/smartRecipe";

export default async function getOneRecipe(id: string): Promise<Recipe | null> {
  const session = await getSession(await cookies());
  return getCachedRecipe(id, session.user)
}

const getCachedRecipe = unstable_cache(
  async (id: string, user: LoginData['user']): Promise<Recipe | null> => {
    let recipe: SmartRecipe | null = null;

    // If user is admin, always get the goal
    if (user?.isAdmin) {
      try {
        const recipeData = await prisma.recipe.findUnique({
          where: { id },
        });
        if (!recipeData) {
          return null;
        }
        recipe = SmartRecipe.fromObject(recipeData.recipe);
      } catch (error) {
        console.log(error);
        console.log('Error fetching admin goal');
        return null
      }

      return recipe.toRecipe();
    }

    // If user is logged in, get the goal if they have access to it
    if (user?.isLoggedIn) {
      try {
        // Where recipe id, and user has access to anything using the data series' using this recipe
        const recipeData = await prisma.recipe.findUnique({
          where: {
            id,
            derivedDataSeries: {
              some: {
                OR: [
                  {
                    dependentGoals: {
                      some: {
                        OR: [
                          { authorId: user.id },
                          { roadmap: { isPublic: true } },
                          { roadmap: { editors: { some: { id: user.id } } } },
                          { roadmap: { viewers: { some: { id: user.id } } } },
                          { roadmap: { editGroups: { some: { users: { some: { id: user.id } } } } } },
                          { roadmap: { viewGroups: { some: { users: { some: { id: user.id } } } } } },
                        ],
                      },
                    },
                  },
                  {
                    dependentEffects: {
                      some: {
                        OR: [
                          { goal: { authorId: user.id } },
                          { goal: { roadmap: { isPublic: true } } },
                          { goal: { roadmap: { editors: { some: { id: user.id } } } } },
                          { goal: { roadmap: { viewers: { some: { id: user.id } } } } },
                          { goal: { roadmap: { editGroups: { some: { users: { some: { id: user.id } } } } } } },
                          { goal: { roadmap: { viewGroups: { some: { users: { some: { id: user.id } } } } } } },
                        ],
                      },
                    },
                  },
                  {
                    dependentBaselines: {
                      some: {
                        OR: [
                          { roadmap: { authorId: user.id } },
                          { roadmap: { isPublic: true } },
                          { roadmap: { editors: { some: { id: user.id } } } },
                          { roadmap: { viewers: { some: { id: user.id } } } },
                          { roadmap: { editGroups: { some: { users: { some: { id: user.id } } } } } },
                          { roadmap: { viewGroups: { some: { users: { some: { id: user.id } } } } } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        });
      } catch (error) {
        console.log(error);
        console.log('Error fetching user goal');
        return null
      }

      recipe?.effects.sort(effectSorter);

      return recipe;
    }

    // If user is not logged in, get the goal if it is public
    try {
      recipe = await prisma.goal.findUnique({
        where: {
          id,
          roadmap: { isPublic: true }
        },
        include: goalInclusionSelection,
      }) satisfies Recipe | null;
    } catch (error) {
      console.log(error);
      console.log('Error fetching public goal');
      return null
    }

    recipe?.effects.sort(effectSorter);

    return recipe;
  },
  ['getOneGoal'],
  { revalidate: 600, tags: ['database', 'goal', 'action', 'dataSeries'] }
);