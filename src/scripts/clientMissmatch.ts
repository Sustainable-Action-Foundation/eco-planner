import "./lib/console.ts";
import * as glob from "glob";
import fs from "node:fs";
import path from "node:path";

const thisFile = path.relative(process.cwd(), import.meta.url.replace("file:///", ""));

const files = glob.sync(["src/**/*.ts*"]);

const serverT = [
  "@/lib/i18nServer",
];
const clientT = [
  "react-i18next",
  "useTranslation",
];
const severIndications = [
  "use server",
  // "next/server",
  // "next/headers",
  // "accessChecker",
];
const clientIndications = [
  "use client",
  // "useEffect",
  // "useMemo",
  // "useState",
  // "useRef",
];


files.forEach(filePath => {
  if (thisFile === filePath) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n$/gm);

  let isClient = false;
  let isServer = false;
  let usingClientT = false;
  let usingServerT = false;

  lines.forEach(line => {
    if (serverT.some(t => line.includes(t))) {
      usingServerT = true;
    }
    if (clientT.some(t => line.includes(t))) {
      usingClientT = true;
    }

    if (severIndications.some(t => line.includes(t))) {
      isServer = true;
    }
    if (clientIndications.some(t => line.includes(t))) {
      isClient = true;
    }
  });

  const isTranslated = usingClientT || usingServerT;
  if (!isTranslated) return;

  const isPageOrLayoutFile = filePath.endsWith("page.tsx") || filePath.endsWith("layout.tsx");

  if (isClient && isServer) {
    console.error(`File is using both client and server code`);
    console.log(" ", filePath);
  }
  if (usingClientT && usingServerT) {
    console.error(`File is using both client and server t`);
    console.log(" ", filePath);
  }
  if (isClient && !usingClientT) {
    console.error(`File is using client code and server t`);
    console.log(" ", filePath);
  }
  if ((isServer || !isClient) && !usingServerT) {
    console.error(`File is using server code and client t`);
    console.log(" ", filePath);
  }
  if (!isServer && !isClient && !isPageOrLayoutFile) {
    console.warn("Ambiguous file", { usingServerT, usingClientT });
    console.log(" ", filePath);
  }
});