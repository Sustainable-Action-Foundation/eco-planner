import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { cookies } from "next/headers";

/**
 * Handles POST requests to the metaRoadmap API
 */
export async function POST(request: NextRequest) {
  const [session, body] = await Promise.all([
    getSession(await cookies()),
    request.json(),
  ]);

  console.log(body);
}