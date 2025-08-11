import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { cookies } from "next/headers";
import { DataSeriesArray } from "@/functions/recipe-parser/types";
import { dataSeriesDataFieldNames } from "@/types";

/**
 * Handles POST requests to the metaRoadmap API
 */
export async function POST(request: NextRequest) {
  const [session, body] = await Promise.all([
    getSession(await cookies()),
    request.json(),
  ]);

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (body === null || typeof body !== "object") {
    return new Response("Invalid body", { status: 400 });
  }
  if (!("data" in body) || typeof body.data !== "object") {
    return new Response("Invalid data", { status: 400 });
  }

  // Clean up input data a little bit. TODO - clean more
  const dataArray: DataSeriesArray = {};
  for (const year of dataSeriesDataFieldNames) {
    if (body.data[year]) {
      dataArray[year] = body.data[year] ?? null;
    }
  }

  let dataSeries;
  try {
    dataSeries = await prisma.dataSeries.create({
      data: {
        authorId: session.user.id,
        ...dataArray,
        unit: body.unit || null,

      }
    });
  }
  catch (error) {
    console.error("Error creating data series:", error);
    return new Response("Failed to create data series", { status: 500 });
  }

  return new Response(JSON.stringify({ uuid: dataSeries.id }));
}