import { prisma } from "@/lib/prisma";

export default async function findTypeFromId(id: string): Promise<"action" | "goal" | "roadmap" | "roadmapIteration" | undefined> {
  const [action, goal, roadmap, roadmapIteration] = await Promise.all([
    prisma.actions.findUnique({
      where: {
        id: id,
      },
    }),
    prisma.goals.findUnique({
      where: {
        id: id,
      },
    }),
    prisma.roadmaps.findUnique({
      where: {
        id: id,
      },
    }),
    prisma.roadmapIterations.findUnique({
      where: {
        id: id,
      },
    }),
  ]);
  if (action) return "action";
  if (goal) return "goal";
  if (roadmap) return "roadmap";
  if (roadmapIteration) return "roadmapIteration";
  return undefined;

}
