import { match } from "@formatjs/intl-localematcher";
import { defaultNS, Locales, ns, uniqueLocales } from "i18n.config";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paramLNG = searchParams.get("lng") || Locales.default;
  const paramNS = searchParams.get("ns") || defaultNS;

  // Sanitize params
  const language = match([paramLNG], uniqueLocales, Locales.default);
  const namespace = ns.find((n) => n === paramNS) || defaultNS;

  const filePath = path.join(process.cwd(), `public/locales/${language}/${namespace}.json`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({}, { status: 404 });
  }

  // Try json parse
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (_e) {
    return NextResponse.json({ error: "Failed to parse JSON file" }, { status: 500 });
  }
}