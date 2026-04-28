import { prisma } from "@/lib/prisma";

export default async function findTypeFromId(id: string): Promise<"action" | "goal" | "roadmap" | undefined> {
  const [action, goal, roadmap] = await Promise.all([
    prisma.action.findUnique({
      where: {
        id: id
      }
    }),
    prisma.goal.findUnique({
      where: {
        id: id
      }
    }),
    prisma.roadmap.findUnique({
      where: {
        id: id
      }
    }),
  ]);
  if (action) return "action";
  if (goal) return "goal";
  if (roadmap) return "roadmap";
  return undefined;

}