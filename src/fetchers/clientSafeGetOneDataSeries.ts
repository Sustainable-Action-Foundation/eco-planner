'use server';

import { clientSafeDataSeriesSelection } from "@/fetchers/inclusionSelectors";
import { getSession } from "@/lib/session"
import prisma from "@/prismaClient";
import { cookies } from "next/headers";

export default async function clientSafeGetOneDataSeries(id: string) {
  const session = await getSession(await cookies());

  if (!session || !session.user) {
    return null;
  }

  const dataSeries = await prisma.dataSeries.findUnique({
    where: { id },
    select: {
      ...clientSafeDataSeriesSelection,
    },
  });

  if (!dataSeries) {
    return null;
  }

  return dataSeries;
}