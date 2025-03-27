import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { JSONValue } from "@/types.ts";
import fs from "fs";
import metadata from "package.json" with { type: "json" };

export default async function Page() {
  const gitHash = { shortHash: process.env.GIT_SHORT_HASH, longHash: process.env.GIT_LONG_HASH };

  // If hash is not set in env, try to get it from file
  if (!gitHash.shortHash && !gitHash.longHash) {
    try {
      if (fs.existsSync("src/lib/commitHash.json")) {
        const parsedVersion: JSONValue = JSON.parse(fs.readFileSync("src/lib/commitHash.json", "utf-8"));

        // Set hashes if they are properly formatted
        if (parsedVersion instanceof Object && !(parsedVersion instanceof Array)) {
          if (typeof parsedVersion.shortHash === "string") {
            gitHash.shortHash = parsedVersion?.shortHash;
          }
          if (typeof parsedVersion.longHash === "string") {
            gitHash.longHash = parsedVersion?.longHash;
          }
        }
      }
    } catch { /* Silently fail */ }
  }

  let remoteURL: URL | null = null;
  let commitURL: URL | null = null;
  let version: string | null = null;
  try {
    // Try to get repository url from package.json
    if (metadata.homepage) {
      let repo = metadata.homepage.replace(".git", "");
      if (!repo.endsWith("/")) {
        repo += "/";
      }
      remoteURL = new URL(repo);
    }

    // Try to get version from package.json
    if (metadata.version) {
      version = metadata.version;
    }
  } catch { /* Silently fail */ }

  if ((gitHash.shortHash || gitHash.longHash) && remoteURL) {
    commitURL = new URL(`commit/${gitHash.longHash || gitHash.shortHash}`, remoteURL)
  }

  return (
    <>
      <Breadcrumb customSections={["Information"]} />

      <h1>Information</h1>
      <p>
        Detta verktyg syftar till att bidra till Sveriges klimatomställning.
        I verktyget kan nationella scenarier, även kallade kvantitativa färdplaner, brytas ner till regional och lokal nivå och en handlingsplan kan skapas.
        Handlingsplanen byggs upp av åtgärder vilka relaterar till en specifik målbana och målbanorna utgör tillsammans hela färdplanen.
        Användare kan inspireras av varandras åtgärder, på så sätt skapas en gemensam åtgärdsdatabas för Sverige.
        På lokal nivå kan också olika aktörer samarbeta kring åtgärder.
      </p>

      {/* TODO: Add wiki once created */}

      <p>
        Verktyget är licenserat under AGPL version 3 och koden finns tillgänglig på GitHub: {
          remoteURL ?
            <a href={remoteURL.href} target="_blank" >
              {/* Gets the repository name from a github-like url with a trailing slash, with hostname as fallback */}
              {remoteURL.pathname.split("/")[remoteURL.pathname.split("/").length - 2] || remoteURL.hostname}
            </a>
            :
            <a href="https://github.com/Sustainable-Action-Foundation/eco-planner" target="_blank">här</a>
        }
      </p>

      {
        version
          ? <p>Nuvarande version: {version}</p>
          : null
      }

      {
        gitHash.shortHash || gitHash.longHash
          ? commitURL
            ? <p>Baserad på commit: <a href={commitURL.href} target="_blank" >
              {gitHash.shortHash || gitHash.longHash}
            </a></p>
            :
            <p>Baserad på commit: {gitHash.shortHash || gitHash.longHash}</p>
          : null
      }
    </>
  )
}