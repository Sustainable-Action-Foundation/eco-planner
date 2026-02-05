import "server-only";
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

/** TODO - use the accessChecker? that would require a full db read and then filter on the result, not a filtered query like this is */
const roadmapAccessFilter = (userId: string) => ({
  OR: [
    { isPublic: true },
    { authorId: userId },
    { editors: { some: { id: userId } } },
    { viewers: { some: { id: userId } } },
    { editGroups: { some: { users: { some: { id: userId } } } } },
    { viewGroups: { some: { users: { some: { id: userId } } } } },
  ],
});

const getCachedRecipe = unstable_cache(
  async (id: string, user: LoginData['user']): Promise<Recipe | null> => {
    let recipe: SmartRecipe | null = null;

    // If user is admin, always get the recipe
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
        console.log('Error fetching recipe as admin');
        return null
      }

      return recipe.toRecipe();
    }

    // If user is logged in, get the recipe if they have access to it
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
                          { roadmap: roadmapAccessFilter(user.id) },
                        ],
                      },
                    },
                  },
                  {
                    dependentEffects: {
                      some: {
                        OR: [
                          { goal: { authorId: user.id } },
                          { goal: { roadmap: roadmapAccessFilter(user.id) } },
                        ],
                      },
                    },
                  },
                  {
                    dependentBaselines: {
                      some: {
                        OR: [
                          { roadmap: roadmapAccessFilter(user.id) },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        });
        if (!recipeData) {
          return null;
        }
        recipe = SmartRecipe.fromObject(recipeData.recipe);
      } catch (error) {
        console.log(error);
        console.log('Error fetching recipe as user');
        return null
      }

      return recipe.toRecipe();
    }

    // If user is not logged in, get the recipe if it is public
    try {
      const recipeData = await prisma.recipe.findUnique({
        where: {
          id,
          derivedDataSeries: {
            some: {
              OR: [
                {
                  dependentGoals: {
                    some: {
                      roadmap: { isPublic: true }
                    }
                  }
                },
                {
                  dependentEffects: {
                    some: {
                      goal: {
                        roadmap: { isPublic: true }
                      }
                    }
                  }
                },
                {
                  dependentBaselines: {
                    some: {
                      roadmap: { isPublic: true }
                    }
                  }
                }
              ]
            }
          }
        },
      });
      if (!recipeData) {
        return null;
      }
      recipe = SmartRecipe.fromObject(recipeData.recipe);
    }
    catch (error) {
      console.log(error);
      console.log('Error fetching public recipe');
      return null
    }

    return recipe.toRecipe();
  },
  ['getOneRecipe'],
  { revalidate: 600, tags: ['database', 'recipe', 'dataSeries'] } // TODO - what tags are appropriate here?
);