import { match } from "@formatjs/intl-localematcher";
import { Locales, allNamespaces, uniqueLocales } from "i18n.config";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paramLNG = searchParams.get("lng") || Locales.default;
  const paramNS = searchParams.get("ns") || null;

  // Validate params
  if (!paramLNG || !uniqueLocales.includes(paramLNG as Locales)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }
  if (!paramNS || !allNamespaces.includes(paramNS)) {
    return NextResponse.json({ error: "Invalid namespace" }, { status: 400 });
  }

  // Sanitize params
  const language = match([paramLNG], uniqueLocales, Locales.default);
  const namespace = allNamespaces.find((namespace) => namespace === paramNS);

  const filePath = path.join(process.cwd(), `public/locales/${language}/${namespace}.json`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Locale file not found" }, { status: 404 });
  }

  // Try json parse
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to parse JSON file" }, { status: 500 });
  }
}