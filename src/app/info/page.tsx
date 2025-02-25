import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { JSONValue } from "@/types.ts";
import fs from "fs";
import metadata from "package.json" with { type: "json" };
import { getServerLocale } from "@/functions/serverLocale";
import dict from "./page.dict.json" assert { type: "json" };

export default async function Page() {
  const locale = await getServerLocale();
  
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
    if (metadata.repository) {
      let repo = metadata.repository.replace(".git", "");
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
      <Breadcrumb customSections={[`${dict.breadcrumbInfo[locale]}`]} />

      <h1>{dict.information[locale]}</h1>
      <p>
        {dict.infoBody[locale]}
      </p>

      {/* TODO: Add wiki once created */}

      {
        version
          ? <p>Version: {version}</p>
          : null
      }

      {
        remoteURL
          ? <p>Remote: <a href={remoteURL.href} target="_blank" >
            {/* Gets the repository name from a github-like url with a trailing slash, with hostname as fallback */}
            {remoteURL.pathname.split("/")[remoteURL.pathname.split("/").length - 2] || remoteURL.hostname}
          </a></p>
          : null
      }

      {
        gitHash.shortHash || gitHash.longHash
          ? commitURL
            ? <p>Commit: <a href={commitURL.href} target="_blank" >
              {gitHash.shortHash || gitHash.longHash}
            </a></p>
            :
            <p>Commit: {gitHash.shortHash || gitHash.longHash}</p>
          : null
      }
    </>
  )
}