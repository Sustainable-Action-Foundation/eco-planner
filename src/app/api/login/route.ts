import { NextRequest } from "next/server";
import { getSession, createResponse } from "@/app/_lib/session"

export async function POST(request: NextRequest) {
  const response = new Response();
  const session = await getSession(request, response);

  session.user = {
    id: "1",
    username: "John Doe",
    isLoggedIn: true,
  };

  await session.save();

  return createResponse(
    response,
    JSON.stringify({ message: 'User created' })
  );
}